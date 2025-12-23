import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
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
  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { id } = await ctx.params;

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) return new Response("Property not found", { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseEstimatedValue(body?.estimatedValue ?? null);
  if ("error" in parsed) return new Response(parsed.error, { status: 400 });

  if (parsed.cents === null) {
    await prisma.property.update({
      where: { id },
      data: {
        estimatedValueCents: null,
        estimatedValueUpdatedAt: null,
        estimatedValueSource: null,
        estimatedValueProviderRef: null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.property.update({
    where: { id },
    data: {
      estimatedValueCents: parsed.cents,
      estimatedValueUpdatedAt: new Date(),
      estimatedValueSource: "manual",
      estimatedValueProviderRef: null,
    },
  });

  return NextResponse.json({ ok: true });
}
