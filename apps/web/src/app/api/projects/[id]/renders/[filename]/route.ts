import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";

type Ctx = { params: Promise<{ id: string; filename: string }> };

const RENDER_FILENAME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.mp4$/;

const RENDERS_ROOT = resolve(process.cwd(), "public", "renders");

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, filename } = await params;

  if (!RENDER_FILENAME_RE.test(filename)) {
    return NextResponse.json({ error: "invalid_filename" }, { status: 400 });
  }
  if (!/^[a-z0-9]+$/i.test(id)) {
    return NextResponse.json({ error: "invalid_project_id" }, { status: 400 });
  }

  const projectDir = resolve(RENDERS_ROOT, id);
  const target = resolve(projectDir, filename);
  if (!target.startsWith(projectDir + "/")) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }

  try {
    await unlink(target);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "unlink_failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
