import { NextResponse } from "next/server";
import { requireAccountId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const accountId = await requireAccountId();

  const tenants = await prisma.tenant.findMany({
    where: {
      leaseTenants: {
        some: {
          lease: {
            property: {
              accountId,
            },
          },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ tenants });
}

export async function POST(req: Request) {
  const accountId = await requireAccountId();

  const formData = await req.formData();

  const returnTo = (formData.get("returnTo")?.toString() || "/").trim();

  const firstName = (formData.get("firstName")?.toString() || "").trim();
  const lastName = (formData.get("lastName")?.toString() || "").trim();

  const emailRaw = (formData.get("email")?.toString() || "").trim();
  const phoneRaw = (formData.get("phone")?.toString() || "").trim();
  const notesRaw = (formData.get("notes")?.toString() || "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const leaseId = (formData.get("leaseId")?.toString() || "").trim();
  if (leaseId) {
    const scopedLease = await prisma.lease.findFirst({
      where: {
        id: leaseId,
        property: { accountId },
      },
      select: { id: true },
    });
    if (!scopedLease) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  await prisma.tenant.create({
    data: {
      firstName,
      lastName,
      email: emailRaw.length ? emailRaw : null,
      phone: phoneRaw.length ? phoneRaw : null,
      notes: notesRaw.length ? notesRaw : null,
    },
  });

  return NextResponse.redirect(new URL(returnTo, req.url));
}
