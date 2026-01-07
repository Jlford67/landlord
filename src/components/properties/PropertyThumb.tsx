import Image from "next/image";
import fs from "node:fs/promises";
import path from "node:path";

async function findPropertyPhotoSrc(propertyId: string): Promise<string | null> {
  const dir = path.join(process.cwd(), "public", "property-photos");

  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return null;
  }

  const byLower = new Map(files.map((f) => [f.toLowerCase(), f] as const));

  for (const ext of ["webp", "jpg", "jpeg", "png"]) {
    const wantLower = `${propertyId}.${ext}`.toLowerCase();
    const actual = byLower.get(wantLower);
    if (actual) return `/property-photos/${actual}`;
  }

  return null;
}

export default async function PropertyThumb({ propertyId }: { propertyId: string }) {
  const photoSrc = await findPropertyPhotoSrc(propertyId);

  return (
    <div className="ll_pickThumb">
      {photoSrc ? (
        <Image src={photoSrc} alt="" fill sizes="48px" className="ll_pickThumbImg" priority={false} />
      ) : (
        <div className="ll_pickThumbFallback" aria-hidden="true" />
      )}
    </div>
  );
}
