import PropertyLedgerPage from "@/app/(shell)/properties/[id]/ledger/page";

export default async function LedgerPropertyPage({
  params,
  searchParams,
}: {
  params: { propertyId: string };
  searchParams?: { month?: string; view?: string; year?: string };
}) {
  const { propertyId } = await params;

  return PropertyLedgerPage({
    params: { id: propertyId },
    searchParams: searchParams ?? {},
  } as any);
}
