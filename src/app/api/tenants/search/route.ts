import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type TenantRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        "id",
        "firstName",
        "lastName",
        "email"
      FROM "Tenant"
      WHERE
        lower("firstName") LIKE ${like}
        OR lower("lastName") LIKE ${like}
        OR lower(COALESCE("email", '')) LIKE ${like}
        OR lower(COALESCE("phone", '')) LIKE ${like}
      ORDER BY "lastName" ASC, "firstName" ASC
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
