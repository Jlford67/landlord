"use server";

import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

function normalize(v: unknown) {
  return String(v ?? "").trim();
}

function validate(kind: "zillow" | "redfin", raw: string): string | null {
  const url = raw.trim();
  if (!url) return null; // blank clears

  const lower = url.toLowerCase();

  if (!lower.startsWith("https://")) {
    throw new Error("Links must start with https://");
  }

  if (kind === "zillow" && !lower.includes("zillow.com")) {
    throw new Error("Zillow link must contain zillow.com");
  }

  if (kind === "redfin" && !lower.includes("redfin.com")) {
    throw new Error("Redfin link must contain redfin.com");
  }

  return url;
}

export async function updatePropertyExternalLinks(input: {
  propertyId: string;
  zillowUrl: unknown;
  redfinUrl: unknown;
}) {
  const accountId = await requireAccountId();

  const z = validate("zillow", normalize(input.zillowUrl));
  const r = validate("redfin", normalize(input.redfinUrl));

  await prisma.property.updateMany({
    where: { id: input.propertyId, accountId },
    data: { zillowUrl: z, redfinUrl: r },
  });

  return { ok: true as const };
}
