import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PageTitleIcon from "@/components/ui/PageTitleIcon";
import IconButton from "@/components/ui/IconButton";
import { BookOpen, Building2, Search, Trash2 } from "lucide-react";

import fs from "node:fs/promises";
import path from "node:path";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function getMsg(sp: SearchParams): string {
  return getStr(sp, "msg").trim();
}

function msgText(msg: string) {
  if (msg === "deleted") return "Property deleted.";
  if (msg === "deactivated") return "Property has leases or transactions, so it was marked inactive instead of deleted.";
  if (msg === "reactivated") return "Property reactivated.";
  if (msg === "notfound") return "Property not found.";
  return "";
}

async function findPropertyPhotoSrc(propertyId: string): Promise<string | null> {
  const dir = path.join(process.cwd(), "public", "property-photos");
  const candidates = [`${propertyId}.webp`, `${propertyId}.jpg`, `${propertyId}.jpeg`, `${propertyId}.png`];

  for (const file of candidates) {
    try {
      await fs.access(path.join(dir, file));
      return `/property-photos/${file}`;
    } catch {
      // keep trying
    }
  }
  return null;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const q = getStr(sp, "q").trim();
  const msg = getMsg(sp);

  const properties = await prisma.property.findMany({
    where: q
      ? {
          OR: [
            { nickname: { contains: q } },
            { street: { contains: q } },
            { city: { contains: q } },
            { state: { contains: q } },
            { zip: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const notice = msgText(msg);

  // Preload photo urls once (server-side)
  const photoPairs = await Promise.all(
    properties.map(async (p) => [p.id, await findPropertyPhotoSrc(p.id)] as const)
  );
  const photoById = new Map<string, string | null>(photoPairs);

  return (
    <div className="ll_page">
      <div className="ll_card">
        <div className="flex items-center gap-3">
          <PageTitleIcon className="bg-amber-100 text-amber-700">
            <Building2 size={18} />
          </PageTitleIcon>
          <div className="text-lg font-semibold">Properties</div>
          <div className="ll_spacer" />
          <Link className="ll_btn ll_btnWarning" href="/properties/new">
            Add property
          </Link>
        </div>

        {notice ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {notice}
          </div>
        ) : null}

        <form method="get" className="mt-4">
          <div className="ll_label mb-1">Search (nickname, street, city, state, zip)</div>

          <div className="flex items-center gap-2">
            <input
              className="ll_input"
              name="q"
              defaultValue={q}
              placeholder="Type and press Enter..."
              autoComplete="off"
              suppressHydrationWarning
            />

            <IconButton
              className="ll_btn ll_btnGhost"
              type="submit"
              ariaLabel="Search"
              title="Search"
              icon={<Search size={18} />}
            />

            {q ? (
              <Link className="ll_btn" href="/properties">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        <div className="mt-4">
          {properties.length ? (
            <div className="ll_list">
              {properties.map((p) => {
                const photoSrc = photoById.get(p.id) ?? null;
                const propertyName = p.nickname?.trim() || p.street;

                return (
                  <div key={p.id} className="ll_list_row">
                    <Link
                      href={`/properties/${p.id}`}
                      className="ll_header_link flex items-center gap-3 min-w-0 flex-1"
                    >
                      <div className="ll_pickThumb">
                        {photoSrc ? (
                          <Image
                            src={photoSrc}
                            alt=""
                            fill
                            sizes="48px"
                            className="ll_pickThumbImg"
                            priority={false}
                          />
                        ) : (
                          <div className="ll_pickThumbFallback" aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="ll_list_title truncate">
                            {p.nickname?.trim() || "(no nickname)"}
                          </div>

                          {p.status && p.status !== "active" ? (
                            <span className="ll_pill">{p.status}</span>
                          ) : null}
                        </div>

                        <div className="ll_list_sub">
                          {[p.street, [p.city, p.state, p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </Link>

                    <div className="ll_actions">
                      <Link
                        className="ll_btn ll_btnLink"
                        href={`/properties/${p.id}/ledger`}
                        aria-label={`Open ledger for ${propertyName}`}
                        title="Open ledger"
                        style={{ padding: "4px 6px" }}
                      >
                        <BookOpen size={18} className="text-blue-600" />
                      </Link>

                      {p.status && p.status !== "active" ? (
                        <form method="post" action={`/api/properties/${p.id}/reactivate`} style={{ margin: 0 }}>
                          <button className="ll_btn" type="submit" suppressHydrationWarning>
                            Reactivate
                          </button>
                        </form>
                      ) : (
                        <form method="post" action={`/api/properties/${p.id}/delete`} style={{ margin: 0 }}>
                          <button
                            className="ll_btn ll_btnLink"
                            type="submit"
                            suppressHydrationWarning
                            aria-label={`Delete ${propertyName}`}
                            title="Delete"
                            style={{ padding: "4px 6px" }}
                          >
                            <Trash2 size={18} className="text-blue-600" />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ll_muted">No properties found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
