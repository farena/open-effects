import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { PresetDefinitionSchema } from "@open-effects/shared-types";
import { rowToStoredPreset } from "@/lib/presets/store";

const CreateBody = PresetDefinitionSchema;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const where = category ? { category } : {};
  const rows = await db.animationPreset.findMany({
    where,
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(rows.map(rowToStoredPreset));
}

export async function POST(req: Request) {
  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const existing = await db.animationPreset.findUnique({
    where: { key: d.key },
  });
  if (existing) {
    return NextResponse.json(
      { error: "key_already_exists" },
      { status: 409 },
    );
  }
  const row = await db.animationPreset.create({
    data: {
      key: d.key,
      name: d.name,
      category: d.category,
      iconKey: d.iconKey,
      defaultDuration: d.defaultDuration,
      defaultEasing: d.defaultEasing as Prisma.InputJsonValue,
      params: d.params as unknown as Prisma.InputJsonValue,
      animatedProperties: d.animatedProperties as unknown as Prisma.InputJsonValue,
      tracks: d.tracks as unknown as Prisma.InputJsonValue,
      isBuiltIn: false,
    },
  });
  return NextResponse.json(rowToStoredPreset(row), { status: 201 });
}
