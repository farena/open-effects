import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toProjectJson } from "@/lib/persistence/toProjectJson";
import { persistProjectJson } from "@/lib/persistence/persistProjectJson";
import { ProjectSchema } from "@open-effects/shared-types";

type Ctx = { params: Promise<{ id: string }> };

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
  await persistProjectJson(id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
