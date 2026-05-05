import path from "node:path";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { getBundleUrl } from "./bundleCache";
import { buildRenderProject } from "./buildRenderProject";
import { ensureOutputDir, timestampedFilename } from "./outputPath";
import { renderRegistry } from "./renderRegistry";

const COMPOSITION_ID = "Project";

export async function runRenderJob(jobId: string, projectId: string) {
  try {
    renderRegistry.update(jobId, { status: "bundling" });
    const serveUrl = await getBundleUrl();

    const { project, totalDurationFrames } =
      await buildRenderProject(projectId);

    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps: { project },
    });

    const { absDir, publicDir } = await ensureOutputDir(projectId);
    const filename = timestampedFilename();
    const outputLocation = path.join(absDir, filename);

    renderRegistry.update(jobId, { status: "rendering" });

    await renderMedia({
      serveUrl,
      composition: {
        ...composition,
        width: project.width,
        height: project.height,
        fps: project.fps,
        durationInFrames: Math.max(1, totalDurationFrames),
      },
      codec: "h264",
      outputLocation,
      inputProps: { project },
      onProgress: ({ progress }) => {
        renderRegistry.update(jobId, { progress });
      },
    });

    renderRegistry.update(jobId, {
      status: "completed",
      progress: 1,
      outputUrl: `${publicDir}/${filename}`,
      finishedAt: Date.now(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    renderRegistry.update(jobId, {
      status: "error",
      error: message,
      finishedAt: Date.now(),
    });
  }
}
