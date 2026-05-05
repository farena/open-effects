import { db } from "@/lib/db";
import { ProjectSchema, type Project } from "@open-effects/shared-types";

export async function toProjectJson(projectId: string): Promise<Project> {
  const p = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      scenes: {
        orderBy: { order: "asc" },
        include: {
          layers: {
            orderBy: { order: "asc" },
            include: {
              keyframes: { orderBy: [{ property: "asc" }, { frame: "asc" }] },
            },
          },
          audioTracks: {
            include: {
              asset: true,
              volumeKeyframes: { orderBy: { frame: "asc" } },
            },
          },
        },
      },
    },
  });

  const project: Project = {
    id: p.id,
    name: p.name,
    width: p.width,
    height: p.height,
    fps: p.fps as 24 | 30 | 60,
    scenes: p.scenes.map((s) => ({
      id: s.id,
      order: s.order,
      name: s.name,
      background: s.background,
      durationFrames: s.durationFrames,
      keyframes: (s.keyframes as Project["scenes"][number]["keyframes"]) ?? [],
      transitionIn:
        (s.transitionIn as Project["scenes"][number]["transitionIn"]) ?? null,
      layers: s.layers.map((l) => ({
        id: l.id,
        order: l.order,
        name: l.name,
        html: l.html,
        css: l.css,
        startFrame: l.startFrame,
        endFrame: l.endFrame,
        visible: (l as { visible?: boolean }).visible ?? true,
        keyframes: l.keyframes.map((k) => ({
          id: k.id,
          frame: k.frame,
          property: k.property,
          value: k.value,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          easingOut: k.easingOut as any,
        })),
      })),
      audioTracks: s.audioTracks.map((t) => ({
        id: t.id,
        assetId: t.assetId,
        assetPath: t.asset.path,
        startFrame: t.startFrame,
        trimStart: t.trimStart,
        trimEnd: t.trimEnd,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eq: (t.eq as any) ?? null,
        volumeKeyframes: t.volumeKeyframes.map((k) => ({
          id: k.id,
          frame: k.frame,
          value: k.value,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          easingOut: k.easingOut as any,
        })),
      })),
    })),
  };

  return ProjectSchema.parse(project);
}
