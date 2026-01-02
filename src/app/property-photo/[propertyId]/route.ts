import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const exts = ["webp", "jpg", "jpeg", "png"];

export async function GET(
  req: Request,
  ctx: { params: Promise<{ propertyId?: string }> }
) {
  const { params } = ctx;
  const p = (await params) ?? {};
  const id = (p.propertyId ?? "").trim();

  // basic safety: only allow id-like strings (your prisma ids are lowercase-ish)
  if (!id || !/^[a-z0-9]+$/i.test(id)) {
    return new NextResponse("Bad propertyId", { status: 400 });
  }

  const baseDir = path.join(process.cwd(), "public", "property-photos");

  for (const ext of exts) {
    const abs = path.join(baseDir, `${id}.${ext}`);
    try {
      await fs.access(abs);
      return NextResponse.redirect(new URL(`/property-photos/${id}.${ext}`, req.url));
    } catch {
      // try next
    }
  }

  return new NextResponse("Not found", { status: 404 });
}
