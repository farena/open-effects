import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { PresetDefinitionSchema } from "@open-effects/shared-types";
import { rowToStoredPreset } from "@/lib/presets/store";

const PatchBody = PresetDefinitionSchema.partial().extend({
  // key may be edited only for non-built-in presets; enforced below.
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await db.animationPreset.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(rowToStoredPreset(row));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await db.animationPreset.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Built-in presets keep their key (used as a stable identifier elsewhere).
  if (existing.isBuiltIn && d.key !== undefined && d.key !== existing.key) {
    return NextResponse.json(
      { error: "cannot_change_builtin_key" },
      { status: 400 },
    );
  }

  // If the user is changing the key, ensure no collision.
  if (d.key !== undefined && d.key !== existing.key) {
    const collision = await db.animationPreset.findUnique({
      where: { key: d.key },
    });
    if (collision) {
      return NextResponse.json(
        { error: "key_already_exists" },
        { status: 409 },
      );
    }
  }

  const data: Prisma.AnimationPresetUpdateInput = {};
  if (d.key !== undefined) data.key = d.key;
  if (d.name !== undefined) data.name = d.name;
  if (d.category !== undefined) data.category = d.category;
  if (d.iconKey !== undefined) data.iconKey = d.iconKey;
  if (d.defaultDuration !== undefined) data.defaultDuration = d.defaultDuration;
  if (d.defaultEasing !== undefined)
    data.defaultEasing = d.defaultEasing as Prisma.InputJsonValue;
  if (d.params !== undefined)
    data.params = d.params as unknown as Prisma.InputJsonValue;
  if (d.animatedProperties !== undefined)
    data.animatedProperties =
      d.animatedProperties as unknown as Prisma.InputJsonValue;
  if (d.tracks !== undefined)
    data.tracks = d.tracks as unknown as Prisma.InputJsonValue;

  const row = await db.animationPreset.update({
    where: { id },
    data,
  });
  return NextResponse.json(rowToStoredPreset(row));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await db.animationPreset.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.isBuiltIn) {
    return NextResponse.json(
      { error: "cannot_delete_builtin" },
      { status: 400 },
    );
  }
  await db.animationPreset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
