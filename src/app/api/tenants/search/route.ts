import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

type TenantRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

export async function GET(req: Request) {
  try {
    const accountId = await requireAccountId();

    const url = new URL(req.url);
    const qRaw = (url.searchParams.get("q") || "").trim();

    if (qRaw.length < 2) {
      return NextResponse.json({ tenants: [] });
    }

    const q = qRaw.toLowerCase();
    const like = `%${q}%`;

    // SQLite case-insensitive search using LOWER(...) LIKE ...
    const tenants = await prisma.$queryRaw<TenantRow[]>`
      SELECT
        DISTINCT t."id",
        t."firstName",
        t."lastName",
        t."email"
      FROM "Tenant" t
      INNER JOIN "LeaseTenant" lt ON lt."tenantId" = t."id"
      INNER JOIN "Lease" l ON l."id" = lt."leaseId"
      INNER JOIN "Property" p ON p."id" = l."propertyId"
      WHERE
        p."accountId" = ${accountId}
        AND (
          lower(t."firstName") LIKE ${like}
          OR lower(t."lastName") LIKE ${like}
          OR lower(COALESCE(t."email", '')) LIKE ${like}
          OR lower(COALESCE(t."phone", '')) LIKE ${like}
        )
      ORDER BY t."lastName" ASC, t."firstName" ASC
      LIMIT 20
    `;

    return NextResponse.json({ tenants });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Tenant search failed", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
