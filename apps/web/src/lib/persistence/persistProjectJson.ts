import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ProjectSchema, type Project } from "@open-effects/shared-types";

export async function persistProjectJson(
  projectId: string,
  project: Project,
): Promise<void> {
  const validated = ProjectSchema.parse(project);

  await db.$transaction(
    async (tx) => {
      // Update root fields
      await tx.project.update({
        where: { id: projectId },
        data: {
          name: validated.name,
          width: validated.width,
          height: validated.height,
          fps: validated.fps,
          css: validated.css ?? "",
        },
      });

      // Replace strategy: delete all scenes (cascades to layers/keyframes/audioTracks/volumeKeyframes)
      // and re-insert. Acceptable for v1 with autosave debounced — runs on a single user.
      await tx.scene.deleteMany({ where: { projectId } });

      for (const scene of validated.scenes) {
        await tx.scene.create({
          data: {
            id: scene.id,
            projectId,
            order: scene.order,
            name: scene.name,
            background: scene.background,
            durationFrames: scene.durationFrames,
            keyframes: scene.keyframes as unknown as Prisma.InputJsonValue,
            // transitionIn is Json? with no @default — must write Prisma.JsonNull for null
            // to avoid leaving the column in an undefined state after DELETE+INSERT.
            transitionIn: scene.transitionIn ?? Prisma.JsonNull,
            layers: {
              create: scene.layers.map((l) => ({
                id: l.id,
                order: l.order,
                name: l.name,
                html: l.html,
                css: l.css,
                startFrame: l.startFrame,
                endFrame: l.endFrame,
                visible: l.visible,
                keyframes: {
                  create: l.keyframes.map((k) => ({
                    id: k.id,
                    frame: k.frame,
                    property: k.property,
                    value: k.value,
                    easingOut: k.easingOut as Prisma.InputJsonValue,
                  })),
                },
              })),
            },
            audioTracks: {
              create: scene.audioTracks.map((t) => ({
                id: t.id,
                assetId: t.assetId,
                startFrame: t.startFrame,
                trimStart: t.trimStart,
                trimEnd: t.trimEnd,
                // eq is Json? with no @default — same pattern as transitionIn
                eq: t.eq ?? Prisma.JsonNull,
                volumeKeyframes: {
                  create: t.volumeKeyframes.map((k) => ({
                    id: k.id,
                    frame: k.frame,
                    value: k.value,
                    easingOut: k.easingOut as Prisma.InputJsonValue,
                  })),
                },
              })),
            },
          },
        });
      }
    },
    { timeout: 15000 },
  );
}
