import PropertyLedgerPage from "@/app/(shell)/properties/[id]/ledger/page";

export default async function LedgerPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ month?: string; view?: string; year?: string }>;
}) {
  const { propertyId } = await params;

  return PropertyLedgerPage({
    params: Promise.resolve({ id: propertyId }),
    searchParams,
  });
}
