import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toProjectJson } from "@/lib/persistence/toProjectJson";
import { persistProjectJson } from "@/lib/persistence/persistProjectJson";
import { ProjectSchema } from "@open-effects/shared-types";
import { Prisma } from "@/generated/prisma/client";

type Ctx = { params: Promise<{ id: string }> };

function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try { return NextResponse.json(await toProjectJson(id)); }
  catch { return NextResponse.json({ error: "not_found" }, { status: 404 }); }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const parsed = ProjectSchema.safeParse({ ...body, id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    await persistProjectJson(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isRecordNotFound(err)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await db.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isRecordNotFound(err)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    throw err;
  }
}
