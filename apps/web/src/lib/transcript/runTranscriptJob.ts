import path from "node:path";
import { db } from "@/lib/db";
import { transcriptRegistry } from "./transcriptRegistry";
import { transcribeAudio } from "./whisperClient";

/**
 * Orchestrator for a transcript job. Runs fire-and-forget; updates the
 * transcriptRegistry at each checkpoint so SSE subscribers receive progress.
 */
export async function runTranscriptJob(
  jobId: string,
  opts: {
    projectId: string;
    trackId: string;
    model: string;
    language: string;
  },
): Promise<void> {
  const { projectId, trackId, model, language } = opts;

  const job = transcriptRegistry.get(jobId);
  if (!job) {
    console.warn(`[runTranscriptJob] job ${jobId} not found in registry`);
    return;
  }

  try {
    // 1. Fetch the audio track + its asset
    const track = await db.audioTrack.findUnique({
      where: { id: trackId },
      include: { asset: true },
    });
    if (!track) {
      transcriptRegistry.update(jobId, {
        status: "error",
        error: "track not found",
        finishedAt: Date.now(),
      });
      return;
    }

    // 2. Fetch project fps
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { fps: true },
    });
    if (!project) {
      transcriptRegistry.update(jobId, {
        status: "error",
        error: "project not found",
        finishedAt: Date.now(),
      });
      return;
    }

    // 3. Resolve the audio file's absolute path on disk.
    //    asset.path is a public-relative URL like "/assets/<sha256>.<ext>".
    //    We strip the leading "/" and join with the Next.js public directory.
    const publicRelative = track.asset.path.replace(/^\//, "");
    const filePath = path.join(process.cwd(), "public", publicRelative);

    // 4. Run transcription with status callbacks
    const transcript = await transcribeAudio({
      filePath,
      assetSha: track.asset.sha256,
      model,
      language,
      fps: project.fps,
      onStatus: (s) => {
        const current = transcriptRegistry.get(jobId);
        transcriptRegistry.update(jobId, {
          status: s,
          progress:
            s === "model-loading"
              ? 0.1
              : s === "transcribing"
                ? 0.5
                : current?.progress ?? 0,
        });
      },
    });

    // 5. Mark completed
    transcriptRegistry.update(jobId, {
      status: "completed",
      progress: 1,
      transcript,
      finishedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    transcriptRegistry.update(jobId, {
      status: "error",
      error: message,
      finishedAt: Date.now(),
    });
  }
}
