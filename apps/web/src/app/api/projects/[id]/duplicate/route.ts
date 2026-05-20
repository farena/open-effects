import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toProjectJson } from "@/lib/persistence/toProjectJson";
import { persistProjectJson } from "@/lib/persistence/persistProjectJson";
import {
  ProjectSchema,
  VideoScriptSchema,
  type Project,
  type VideoScript,
} from "@open-effects/shared-types";
import { Prisma } from "@/generated/prisma/client";
import { newId } from "@/lib/ids";

type Ctx = { params: Promise<{ id: string }> };

function isRecordNotFound(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025"
  );
}

function cloneWithFreshIds(
  source: Project,
  newProjectId: string,
  newName: string,
): Project {
  return {
    ...source,
    id: newProjectId,
    name: newName,
    scenes: source.scenes.map((s) => ({
      ...s,
      id: newId(),
      layers: s.layers.map((l) => ({
        ...l,
        id: newId(),
        keyframes: l.keyframes.map((k) => ({ ...k, id: newId() })),
      })),
      audioTracks: s.audioTracks.map((t) => ({
        ...t,
        id: newId(),
        volumeKeyframes: t.volumeKeyframes.map((k) => ({ ...k, id: newId() })),
      })),
    })),
  };
}

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;

  let source: Project;
  let videoScript: VideoScript;
  try {
    source = await toProjectJson(id);
    const row = await db.project.findUniqueOrThrow({
      where: { id },
      select: { videoScript: true },
    });
    const parsedScript = VideoScriptSchema.safeParse(row.videoScript);
    videoScript = parsedScript.success ? parsedScript.data : [];
  } catch (err) {
    if (isRecordNotFound(err)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw err;
  }

  const duplicatedName = `${source.name} (duplicated)`;
  const duplicated = await db.project.create({
    data: {
      name: duplicatedName,
      width: source.width,
      height: source.height,
      fps: source.fps,
      css: source.css ?? "",
      videoScript: videoScript as unknown as Prisma.InputJsonValue,
    },
  });

  const cloned = cloneWithFreshIds(source, duplicated.id, duplicatedName);

  try {
    await persistProjectJson(duplicated.id, ProjectSchema.parse(cloned));
  } catch (err) {
    // Roll back the empty Project row so a failed duplicate doesn't leave a
    // half-created project visible in the projects list.
    await db.project.delete({ where: { id: duplicated.id } }).catch(() => {});
    throw err;
  }

  return NextResponse.json({ id: duplicated.id }, { status: 201 });
}
