import { NextResponse } from "next/server";
import { processUpload } from "@/lib/assets/upload";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  try {
    const asset = await processUpload(file);
    return NextResponse.json(asset, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upload_failed" },
      { status: 400 },
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? undefined;
  const where = type ? { type } : {};
  const assets = await db.asset.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(assets);
}
