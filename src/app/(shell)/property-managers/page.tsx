import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PropertyHeader from "@/components/properties/PropertyHeader";

import fs from "node:fs/promises";
import path from "node:path";

function getStr(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function propertyLabel(p: {
  nickname: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  return p.nickname?.trim() || `${p.street}, ${p.city}, ${p.state} ${p.zip}`;
}

async function findPropertyPhotoSrc(propertyId: string): Promise<string | null> {
  // Files live in /public/property-photos; URLs are /property-photos/<file>
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

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PropertyManagersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();
  const sp = searchParams ? await searchParams : {};
  const q = getStr(sp, "q").trim();
  const propertyId = getStr(sp, "propertyId").trim();
  const msg = getStr(sp, "msg").trim();

  const [managers, properties, selectedProperty] = await Promise.all([
    prisma.propertyManager.findMany({
      where:
        q || propertyId
          ? {
              AND: [
                q
                  ? {
                      OR: [
                        { companyName: { contains: q } },
                        { contactName: { contains: q } },
                        { email: { contains: q } },
                        { phone: { contains: q } },
                        { website: { contains: q } },
                        {
                          assignments: {
                            some: {
                              property: {
                                OR: [
                                  { nickname: { contains: q } },
                                  { street: { contains: q } },
                                  { city: { contains: q } },
                                  { state: { contains: q } },
                                  { zip: { contains: q } },
                                ],
                              },
                            },
                          },
                        },
                      ],
                    }
                  : {},
                propertyId
                  ? {
                      assignments: {
                        some: { propertyId },
                      },
                    }
                  : {},
              ],
            }
          : undefined,
      include: {
        assignments: {
          orderBy: [{ startDate: "desc" }],
          take: 3,
          include: {
            property: {
              select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
            },
          },
        },
        _count: { select: { assignments: true } },
      },
      orderBy: [{ companyName: "asc" }],
      take: 500,
    }),
    prisma.property.findMany({
      orderBy: [{ nickname: "asc" }],
      select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
    }),
    propertyId
      ? prisma.property.findUnique({
          where: { id: propertyId },
          select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
        })
      : Promise.resolve(null),
  ]);

  const photoSrc = selectedProperty ? await findPropertyPhotoSrc(selectedProperty.id) : null;

  const addHref = propertyId ? `/property-managers/new?propertyId=${propertyId}` : "/property-managers/new";

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Property managers</div>
            <div className="ll_muted">
              {selectedProperty ? "Managers for selected property." : "All property managers across all properties."}
            </div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btn" href={addHref}>
              New property manager
            </Link>
          </div>
        </div>

        {selectedProperty ? (
          <div className="mt-3">
            <PropertyHeader
              property={{
                id: selectedProperty.id,
                nickname: selectedProperty.nickname,
                street: selectedProperty.street,
                city: selectedProperty.city,
                state: selectedProperty.state,
                zip: selectedProperty.zip,
                photoUrl: photoSrc ?? null,
              }}
              href={`/properties/${selectedProperty.id}`}
              subtitle="Property managers"
            />
          </div>
        ) : null}

        {msg === "created" && <div className="ll_notice">Property manager created.</div>}
        {msg === "updated" && <div className="ll_notice">Property manager updated.</div>}
        {msg === "deleted" && <div className="ll_notice">Property manager deleted.</div>}

        <div className="ll_card" style={{ marginTop: 14, marginBottom: 14 }}>
          <form method="get" className="ll_form" style={{ margin: 0 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label>
                Search (manager, contact, property)
                <input
                  className="ll_input"
                  name="q"
                  defaultValue={q}
                  placeholder="Type and press Enter..."
                  autoComplete="off"
                  suppressHydrationWarning
                />
              </label>

              <label>
                Property filter (optional)
                <select
                  name="propertyId"
                  className="ll_input"
                  defaultValue={propertyId}
                  suppressHydrationWarning
                >
                  <option value="">All properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {propertyLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              {(q || propertyId) && (
                <Link className="ll_btn" href="/property-managers">
                  Clear
                </Link>
              )}

              <button className="ll_btn ll_btnPrimary" type="submit" suppressHydrationWarning>
                Search
              </button>
            </div>
          </form>
        </div>

        <div className="ll_table_wrap">
          {managers.length ? (
            <table className="ll_table ll_table_zebra">
              <thead>
                <tr>
                  <th scope="col">Manager</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Email</th>
                  <th scope="col">Property</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>

              <tbody>
                {managers.map((pm) => {
                  const assignmentCount = pm._count.assignments;
                  const firstAssignment = pm.assignments[0];
                  const propertyText = firstAssignment?.property
                    ? assignmentCount > 1
                      ? `${propertyLabel(firstAssignment.property)} (+${assignmentCount - 1})`
                      : propertyLabel(firstAssignment.property)
                    : "Unassigned";

                  return (
                    <tr key={pm.id}>
                      <td>{pm.companyName}</td>
                      <td>{pm.contactName || "-"}</td>
                      <td>{pm.phone || "-"}</td>
                      <td>{pm.email || "-"}</td>
                      <td>{propertyText}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <Link className="ll_btnSecondary" href={`/property-managers/${pm.id}/edit`}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="ll_muted">No property managers found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
