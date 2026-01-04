"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

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
  await requireUser();

  const z = validate("zillow", normalize(input.zillowUrl));
  const r = validate("redfin", normalize(input.redfinUrl));

  await prisma.property.update({
    where: { id: input.propertyId },
    data: { zillowUrl: z, redfinUrl: r },
  });

  return { ok: true as const };
}
