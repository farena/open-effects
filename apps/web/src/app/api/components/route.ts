import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { SavedComponentPayloadSchema } from "@open-effects/shared-types";
import { saveThumbnail } from "@/lib/components/saveThumbnail";

const CreateBody = z.object({
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  preview: z.string().nullable().optional(),
  payload: SavedComponentPayloadSchema,
});

export async function POST(req: Request) {
  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const { name, category, preview, payload } = parsed.data;
  // Create the record first (without preview) so we have the generated id
  const c = await db.savedComponent.create({
    data: {
      name,
      category: category ?? null,
      preview: null,
      payload: payload as Prisma.InputJsonValue,
    },
  });
  // If a data-URL preview was provided, decode → write PNG → update the row
  const finalPreview = await saveThumbnail(c.id, preview);
  if (finalPreview) {
    await db.savedComponent.update({
      where: { id: c.id },
      data: { preview: finalPreview },
    });
    return NextResponse.json({ ...c, preview: finalPreview }, { status: 201 });
  }
  return NextResponse.json(c, { status: 201 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const where = category ? { category } : {};
  const list = await db.savedComponent.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(list);
}
