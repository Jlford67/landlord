import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { postRecurringUpToMonth } from "@/lib/recurring";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  try {
    const result = await postRecurringUpToMonth(id, body?.upToMonth);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to post recurring" }, { status: 400 });
  }
}
