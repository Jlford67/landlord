import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PropertyHeader from "@/components/properties/PropertyHeader";
import RecurringPanel from "@/components/ledger/RecurringPanel";

import fs from "node:fs/promises";
import path from "node:path";

function ym(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

export default async function PropertyRecurringPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  await requireUser();

  const { id: propertyId } = await params;
  const sp = await searchParams;

  const month = sp.month ?? ym(new Date());

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
  });

  if (!property) {
    return (
      <div>
        <h1 className="text-[28px] mb-2">Recurring</h1>
        <div className="ll_muted">Property not found.</div>
        <div className="mt-3">
          <Link className="ll_btn" href="/recurring">
            Back
          </Link>
        </div>
      </div>
    );
  }

  const photoSrc = await findPropertyPhotoSrc(propertyId);

  // Recurring data (copy/pasted from Ledger logic)
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  let recurringItems: Awaited<ReturnType<typeof prisma.recurringTransaction.findMany>> = [];
  let recurringTablesReady = true;
  let recurringErrorMsg: string | null = null;

  try {
    recurringItems = await prisma.recurringTransaction.findMany({
      where: { propertyId },
      include: { category: true, postings: true },
      orderBy: [{ isActive: "desc" }, { dayOfMonth: "asc" }, { createdAt: "asc" }],
    });
  } catch (error: any) {
    recurringErrorMsg = error?.message ?? String(error);
    console.error("recurringTransaction.findMany failed", error);

    if (error?.code === "P2021") {
      recurringTablesReady = false;
    } else {
      throw error;
    }
  }

  return (
    <div className="ll_page w-full max-w-none mx-0">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[32px] m-0 mb-1.5">Recurring</h1>

        <Link className="ll_btn" href={`/properties/${propertyId}/ledger?month=${month}`}>
          Back to Ledger
        </Link>
      </div>

      <div className="mt-3">
        <PropertyHeader
          property={{
            id: property.id,
            nickname: property.nickname,
            street: property.street,
            city: property.city,
            state: property.state,
            zip: property.zip,
            photoUrl: photoSrc ?? null,
          }}
          href={`/properties/${propertyId}`}
          subtitle="Recurring"
        />
      </div>

      <div className="mt-4">
        {recurringTablesReady ? (
          <RecurringPanel
            propertyId={propertyId}
            categories={categories}
            recurringItems={recurringItems as any}
            recurringTablesReady={recurringTablesReady}
            recurringErrorMsg={recurringErrorMsg}
            month={month}
          />
        ) : (
          <div className="ll_muted">Tables not ready yet.</div>
        )}
      </div>
    </div>
  );
}
