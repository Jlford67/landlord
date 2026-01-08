import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { propertyLabel } from "@/lib/format";
import PageTitleIcon from "@/components/ui/PageTitleIcon";
import { Repeat } from "lucide-react";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

export default async function RecurringPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const sp = searchParams ? await searchParams : {};
  const q = getStr(sp, "q").trim();

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
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <PageTitleIcon className="bg-amber-100 text-amber-700">
            <Repeat size={18} />
          </PageTitleIcon>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Recurring
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Pick a property to manage recurring transactions.
            </p>
          </div>
        </div>

        <form method="get" className="mt-4">
          <label className="block text-sm font-medium text-slate-700">
            Search (nickname, street, city, state, zip)
            <input
              className="mt-2 w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300"
              name="q"
              defaultValue={q}
              placeholder="Type and press Enter…"
              autoComplete="off"
              suppressHydrationWarning
            />
          </label>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              suppressHydrationWarning
            >
              Search
            </button>

            {q ? (
              <Link
                href="/recurring"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Clear
              </Link>
            ) : null}

            {q ? (
              <div className="ml-2 text-sm text-slate-500">
                Showing {properties.length} result{properties.length === 1 ? "" : "s"}
              </div>
            ) : null}
          </div>
        </form>
      </div>

      {properties.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/properties/${p.id}/ledger`}
              className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-md"
            >
              {/* Thumbnail */}
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/property-photo/${p.id}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {propertyLabel(p)}
                </div>
                <div className="mt-1 truncate text-xs text-slate-600">
                  {p.street}, {p.city}, {p.state} {p.zip}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No properties found.
        </div>
      )}
    </div>
  );
}
