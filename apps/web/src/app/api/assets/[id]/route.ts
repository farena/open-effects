import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unlink } from "node:fs/promises";
import path from "node:path";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const refs = await db.audioTrack.count({ where: { assetId: id } });
  if (refs > 0)
    return NextResponse.json({ error: "in_use", refs }, { status: 409 });
  await db.asset.delete({ where: { id } });
  try {
    await unlink(
      path.resolve(process.cwd(), "public", asset.path.replace(/^\//, "")),
    );
  } catch {
    /* file already gone — fine */
  }
  return NextResponse.json({ ok: true });
}
