import path from "node:path";
import { toProjectJson } from "@/lib/persistence/toProjectJson";
import { resolveAssetForRender } from "./assetResolver";
import { processEq } from "@/lib/audio/processEq";
import type { Project } from "@open-effects/shared-types";

const RENDER_BASE_URL = process.env.RENDER_BASE_URL ?? "http://localhost:3000";

export async function buildRenderProject(
  projectId: string,
): Promise<{ project: Project; totalDurationFrames: number }> {
  const project = await toProjectJson(projectId);

  for (const sc of project.scenes) {
    for (const t of sc.audioTracks) {
      const originalPublicPath = t.assetPath;
      const inputAbsPath = resolveAssetForRender(originalPublicPath);
      const processed = await processEq({
        inputAbsPath,
        assetSha256: t.assetSha256!,
        eq: t.eq ?? null,
      });

      if (processed === inputAbsPath) {
        t.assetPath = `${RENDER_BASE_URL}${originalPublicPath}`;
      } else {
        const filename = path.basename(processed);
        t.assetPath = `${RENDER_BASE_URL}/api/render/eq-asset/${encodeURIComponent(filename)}`;
      }
    }
  }

  const totalDurationFrames = project.scenes.reduce(
    (acc, sc) => acc + sc.durationFrames,
    0,
  );

  return { project, totalDurationFrames };
}
