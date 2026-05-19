import path from "node:path";
import { toProjectJson } from "@/lib/persistence/toProjectJson";
import { resolveAssetForRender } from "./assetResolver";
import { processEq } from "@/lib/audio/processEq";
import type { Project } from "@open-effects/shared-types";

const RENDER_BASE_URL = process.env.RENDER_BASE_URL ?? "http://localhost:3000";

// Remotion serves the render bundle from its own HTTP port (not Next.js).
// Any "/assets/…" inside layer HTML/CSS or project CSS would resolve against
// that port and 404. Prefix bare "/assets/" references with RENDER_BASE_URL so
// Chromium fetches them from Next.js. The negative lookbehind avoids touching
// already-absolute URLs (e.g. "http://host/assets/…").
const ASSET_PATH_REGEX = /(?<![\w:])\/assets\//g;
function rewriteAssetUrls(content: string): string {
  return content.replace(ASSET_PATH_REGEX, `${RENDER_BASE_URL}/assets/`);
}

export async function buildRenderProject(
  projectId: string,
): Promise<{ project: Project; totalDurationFrames: number }> {
  const project = await toProjectJson(projectId);

  if (project.css) {
    project.css = rewriteAssetUrls(project.css);
  }

  for (const sc of project.scenes) {
    for (const layer of sc.layers) {
      layer.html = rewriteAssetUrls(layer.html);
      layer.css = rewriteAssetUrls(layer.css);
    }

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
