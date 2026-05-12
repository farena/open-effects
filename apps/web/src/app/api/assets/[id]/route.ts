import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unlink } from "node:fs/promises";
import path from "node:path";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const filename =
    body && typeof body === "object" && "filename" in body
      ? (body as { filename: unknown }).filename
      : null;
  if (typeof filename !== "string" || filename.trim().length === 0) {
    return NextResponse.json({ error: "invalid_filename" }, { status: 400 });
  }
  if (filename.length > 255) {
    return NextResponse.json({ error: "filename_too_long" }, { status: 400 });
  }
  const existing = await db.asset.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const updated = await db.asset.update({
    where: { id },
    data: { filename: filename.trim() },
  });
  return NextResponse.json(updated);
}

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
