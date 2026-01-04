import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function parseWholeDollars(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") return null;

  const raw = input.trim();
  if (!raw) return null;

  // Reject cents or negatives (whole dollars only)
  if (raw.includes(".") || raw.includes("-")) {
    throw new Error("Estimated value must be a whole-dollar amount (no cents).");
  }

  // Keep digits only (e.g., "$350,000" -> "350000")
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;

  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireUser();

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const estimatedValueRaw = (body as { estimatedValue?: unknown })?.estimatedValue;

  let dollars: number | null = null;
  try {
    dollars = parseWholeDollars(estimatedValueRaw);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid estimated value" },
      { status: 400 }
    );
  }

  const now = new Date();

  await prisma.property.update({
    where: { id },
    data:
      dollars === null
        ? { redfinEstimatedValue: null, redfinEstimatedValueUpdatedAt: null }
        : { redfinEstimatedValue: dollars, redfinEstimatedValueUpdatedAt: now },
  });

  return NextResponse.json({ ok: true });
}
