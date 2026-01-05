import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NewLeaseForm from "@/components/leases/NewLeaseForm";
import PropertyHeader from "@/components/properties/PropertyHeader";
import { promises as fs } from "fs";
import path from "path";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function getStrArray(sp: SearchParams, key: string): string[] {
  const v = sp[key];
  if (typeof v === "string") return v ? [v] : [];
  if (Array.isArray(v)) return v.filter(Boolean) as string[];
  return [];
}

async function findPropertyPhotoUrl(propertyId: string): Promise<string | null> {
  // Looks for /public/property-photos/<propertyId>.(webp|jpg|jpeg|png) with case-insensitive extension
  const dir = path.join(process.cwd(), "public", "property-photos");
  try {
    const files = await fs.readdir(dir);
    const target = propertyId.toLowerCase();

    const match = files.find((f) => {
      const lower = f.toLowerCase();
      if (!lower.startsWith(target + ".")) return false;
      return (
        lower.endsWith(".webp") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png")
      );
    });

    return match ? `/property-photos/${match}` : null;
  } catch {
    return null;
  }
}

export default async function NewLeasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const { id } = await params;
  const sp = searchParams ? await searchParams : {};

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) notFound();

  // Defaults from query string (used when returning from Add Tenant)
  const defaultStartDate = getStr(sp, "startDate");
  const defaultEndDate = getStr(sp, "endDate");
  const defaultRentAmount = getStr(sp, "rentAmount");
  const defaultDueDay = getStr(sp, "dueDay") || "1";
  const defaultDeposit = getStr(sp, "deposit");
  const defaultStatus = getStr(sp, "status") || "active";
  const managedByPmParam = getStr(sp, "managedByPm"); // "1" or "0" or empty
  const defaultManagedByPm = managedByPmParam === "0" ? false : true;
  const defaultNotes = getStr(sp, "notes");

  // Preserve selected tenantIds across "Add tenant"
  const tenantIdsFromQuery = getStrArray(sp, "tenantIds");

  const initialSelectedTenantsRaw = tenantIdsFromQuery.length
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIdsFromQuery } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];

  const initialSelectedTenants = initialSelectedTenantsRaw.map((t) => ({
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    email: t.email ?? null,
  }));

  const returnToBasePath = `/properties/${property.id}/leases/new`;

  const fsPhotoUrl = await findPropertyPhotoUrl(property.id);

  // PropertyHeader expects property.photoUrl for the thumbnail.
  // Prefer the filesystem photo (same behavior as your properties list), then fall back to DB photoUrl.
  const headerProperty = {
    ...property,
    photoUrl: fsPhotoUrl ?? property.photoUrl ?? null,
  };

  return (
    <div className="ll_page" suppressHydrationWarning>
      <div className="ll_panel">
        <PropertyHeader
          // TS note: PropertyHeader is already handling this shape in your other pages.
          // If it complains, we can tighten the prop type in PropertyHeader later.
          property={headerProperty as any}
          href={`/properties/${property.id}`}
          title="New lease"
          rightActions={
            <Link className="ll_btn" href={`/properties/${property.id}/leases`}>
              Back
            </Link>
          }
        />

        <div className="ll_card">
          <NewLeaseForm
            propertyId={property.id}
            backHref={`/properties/${property.id}/leases`}
            actionHref={`/api/properties/${property.id}/leases`}
            defaultStartDate={defaultStartDate}
            defaultEndDate={defaultEndDate}
            defaultRentAmount={defaultRentAmount}
            defaultDueDay={Number(defaultDueDay || 1)}
            defaultDeposit={defaultDeposit}
            defaultStatus={defaultStatus}
            defaultManagedByPm={defaultManagedByPm}
            defaultNotes={defaultNotes}
            returnToBasePath={returnToBasePath}
            initialSelectedTenants={initialSelectedTenants}
          />
        </div>
      </div>
    </div>
  );
}
