import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PropertyHeader from "@/components/properties/PropertyHeader";
import PageTitleIcon from "@/components/ui/PageTitleIcon";
import RowActions from "@/components/ui/RowActions";
import IconButton from "@/components/ui/IconButton";
import { Search, Shield } from "lucide-react";
import { redirect } from "next/navigation";

import fs from "node:fs/promises";
import path from "node:path";

function getStr(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function money(n?: number | null) {
  if (n === null || n === undefined) return "-";

  const abs = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));

  return n < 0 ? `(${abs})` : `$${abs}`;
}

function fmtDate(d?: Date | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { timeZone: "UTC" });
}

async function deleteInsurancePolicy(id: string) {
  "use server";
  await requireUser();
  await prisma.insurancePolicy.delete({ where: { id } });
  redirect("/insurance?msg=deleted");
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

const insuranceColumns = [
  1.4, // Property
  1, // Insurer
  1, // Policy #
  1, // Agent
  1, // Phone
  0.9, // Premium
  0.9, // Due Date
  0.9, // Paid Date
  1.6, // Web Portal
  0.9, // Actions
];

const insuranceColumnPercents = (() => {
  const total = insuranceColumns.reduce((sum, n) => sum + n, 0);
  return insuranceColumns.map((n) => `${(n / total) * 100}%`);
})();

type SearchParams = Record<string, string | string[] | undefined>;

export default async function InsurancePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();
  const sp = searchParams ? await searchParams : {};
  const q = getStr(sp, "q").trim();
  const propertyId = getStr(sp, "propertyId").trim();
  const msg = getStr(sp, "msg").trim();

  const [policies, properties, selectedProperty] = await Promise.all([
    prisma.insurancePolicy.findMany({
      where:
        q || propertyId
          ? {
              AND: [
                q
                  ? {
                      OR: [
                        { insurer: { contains: q } },
                        { policyNum: { contains: q } },
                        { agentName: { contains: q } },
                        {
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
                      ],
                    }
                  : {},
                propertyId ? { propertyId } : {},
              ],
            }
          : undefined,
      include: {
        property: {
          select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
        },
      },
      orderBy: [{ dueDate: "desc" }],
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

  const addHref = propertyId ? `/insurance/new?propertyId=${propertyId}` : "/insurance/new";

  return (
    <div className="ll_page">
      <div className="ll_panel">
        {/* Page header */}
        <div className="ll_card" style={{ marginBottom: 14 }}>
          <div className="ll_topbar" style={{ marginBottom: 0 }}>
            <div className="flex items-center gap-3">
              <PageTitleIcon className="bg-amber-100 text-amber-700">
                <Shield size={18} />
              </PageTitleIcon>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Insurance</div>
                <div className="ll_muted">
                  {selectedProperty ? "Policies for selected property." : "All policies across all properties."}
                </div>
              </div>
            </div>

            <div className="ll_topbarRight">
              <Link className="ll_btn" href="/dashboard">
                Back
              </Link>
              <Link className="ll_btn ll_btnPrimary" href={addHref}>
                Add insurance policy
              </Link>
            </div>
          </div>
        </div>

        {/* Selected property context */}
        {selectedProperty ? (
          <div style={{ marginBottom: 14 }}>
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
              subtitle="Insurance"
            />
          </div>
        ) : null}

        {/* Notices */}
        {msg === "created" && <div className="ll_notice">Policy created.</div>}
        {msg === "updated" && <div className="ll_notice">Policy updated.</div>}
        {msg === "deleted" && <div className="ll_notice">Policy deleted.</div>}

        {/* Filters */}
        <div className="ll_card" style={{ marginTop: 14, marginBottom: 14 }}>
          <form method="get" className="ll_form" style={{ margin: 0 }}>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-[220px]">
                Search (property, insurer, policy #, agent)
                <input
                  className="ll_input"
                  name="q"
                  defaultValue={q}
                  placeholder="Type and press Enter..."
                  autoComplete="off"
                  suppressHydrationWarning
                />
              </label>

              <label className="flex-1 min-w-[220px]">
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

              <IconButton
                className="ll_btn ll_btnPrimary"
                type="submit"
                ariaLabel="Search"
                title="Search"
                icon={<Search size={18} />}
              />

              {(q || propertyId) && (
                <Link className="ll_btn" href="/insurance">
                  Clear
                </Link>
              )}
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="ll_table_wrap">
          {policies.length ? (
            <table className="ll_table ll_table_zebra ll_insuranceTable">
              <colgroup>
                {insuranceColumnPercents.map((width, idx) => (
                  <col key={idx} style={{ width }} />
                ))}
              </colgroup>

              <thead>
                <tr>
                  <th scope="col">Property</th>
                  <th scope="col">Insurer</th>
                  <th scope="col">Policy #</th>
                  <th scope="col">Agent</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Premium</th>
                  <th scope="col">Due Date</th>
                  <th scope="col">Paid Date</th>
                  <th scope="col">Web Portal</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>

              <tbody>
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {propertyLabel(p.property)}
                    </td>
                    <td>{p.insurer || "-"}</td>
                    <td>{p.policyNum || "-"}</td>
                    <td>{p.agentName || "-"}</td>
                    <td>{p.phone || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{money(p.premium)}</td>
                    <td>{fmtDate(p.dueDate)}</td>
                    <td>{fmtDate(p.paidDate)}</td>
                    <td style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.webPortal ? (
                        <a href={p.webPortal} className="ll_muted" style={{ textDecoration: "underline" }}>
                          {p.webPortal}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <RowActions
                        editHref={`/insurance/${p.id}/edit`}
                        deleteAction={deleteInsurancePolicy.bind(null, p.id)}
                        deleteConfirmText={`Delete insurance policy "${p.insurer || p.policyNum || "this policy"}"? This cannot be undone.`}
                        ariaLabelEdit={`Edit insurance policy ${p.insurer || p.policyNum || p.id}`}
                        ariaLabelDelete={`Delete insurance policy ${p.insurer || p.policyNum || p.id}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="ll_muted">No policies found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
