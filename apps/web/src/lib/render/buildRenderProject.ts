import { toProjectJson } from "@/lib/persistence/toProjectJson";
import { resolveAssetForRender } from "./assetResolver";
import { processEq } from "@/lib/audio/processEq";
import type { Project } from "@open-effects/shared-types";

export async function buildRenderProject(
  projectId: string,
): Promise<{ project: Project; totalDurationFrames: number }> {
  const project = await toProjectJson(projectId);

  for (const sc of project.scenes) {
    for (const t of sc.audioTracks) {
      const inputAbsPath = resolveAssetForRender(t.assetPath);
      const processed = await processEq({
        inputAbsPath,
        assetSha256: t.assetSha256!,
        eq: t.eq ?? null,
      });
      t.assetPath = `file://${processed}`;
    }
  }

  const totalDurationFrames = project.scenes.reduce(
    (acc, sc) => acc + sc.durationFrames,
    0,
  );

  return { project, totalDurationFrames };
}
