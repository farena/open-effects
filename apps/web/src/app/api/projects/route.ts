import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { defaultScene } from "@/editor/defaults";
import { persistProjectJson } from "@/lib/persistence/persistProjectJson";

export async function GET() {
  const projects = await db.project.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(projects);
}

const CreateBody = z.object({
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)])
});

export async function POST(req: Request) {
  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { name, width, height, fps } = parsed.data;
  const project = await db.project.create({ data: { name, width, height, fps } });
  // seed with one default scene
  await persistProjectJson(project.id, {
    id: project.id, name, width, height, fps,
    scenes: [defaultScene(0)]
  });
  return NextResponse.json({ id: project.id }, { status: 201 });
}
