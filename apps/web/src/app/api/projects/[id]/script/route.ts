import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  VideoScriptSchema,
  VideoScriptPutSchema,
  type VideoScript,
} from "@open-effects/shared-types";

type Ctx = { params: Promise<{ id: string }> };

function isRecordNotFound(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025"
  );
}

function parseStoredScript(value: unknown): VideoScript {
  const parsed = VideoScriptSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const row = await db.project.findUniqueOrThrow({
      where: { id },
      select: { videoScript: true },
    });
    return NextResponse.json({ lines: parseStoredScript(row.videoScript) });
  } catch (err) {
    if (isRecordNotFound(err)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw err;
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = VideoScriptPutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await db.project.update({
      where: { id },
      data: { videoScript: parsed.data.lines },
    });
    return NextResponse.json({ ok: true, lines: parsed.data.lines });
  } catch (err) {
    if (isRecordNotFound(err)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw err;
  }
}
