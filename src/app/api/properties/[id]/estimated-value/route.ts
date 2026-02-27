import { NextResponse } from "next/server";
import { requireAccountId } from "@/lib/auth";
import { prisma } from "@/lib/db";

function parseEstimatedValue(input: unknown) {
  if (input === null || input === undefined) return { cents: null } as const;
  const raw = String(input).trim();
  if (!raw) return { cents: null } as const;

  const sanitized = raw.replace(/[$,]/g, "");
  if (!sanitized) return { error: "Invalid estimated value" } as const;

  const dollars = Number(sanitized);
  if (!Number.isFinite(dollars)) return { error: "Invalid estimated value" } as const;

  const boundedDollars = Math.min(Math.max(dollars, 0), 100000000);
  const cents = Math.round(boundedDollars * 100);
  return { cents } as const;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const accountId = await requireAccountId();

  const { id } = await ctx.params;

  const property = await prisma.property.findFirst({ where: { id, accountId } });
  if (!property) return new Response("Property not found", { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseEstimatedValue(body?.estimatedValue ?? null);
  if ("error" in parsed) return new Response(parsed.error, { status: 400 });

  if (parsed.cents === null) {
    const cleared = await prisma.property.updateMany({
      where: { id, accountId },
      data: {
        estimatedValueCents: null,
        estimatedValueUpdatedAt: null,
        estimatedValueSource: null,
        estimatedValueProviderRef: null,
      },
    });
    if (cleared.count === 0) return new Response("Property not found", { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const updated = await prisma.property.updateMany({
    where: { id, accountId },
    data: {
      estimatedValueCents: parsed.cents,
      estimatedValueUpdatedAt: new Date(),
      estimatedValueSource: "manual",
      estimatedValueProviderRef: null,
    },
  });

  if (updated.count === 0) return new Response("Property not found", { status: 404 });

  return NextResponse.json({ ok: true });
}
