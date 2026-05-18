import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transcriptRegistry } from "@/lib/transcript/transcriptRegistry";
import { runTranscriptJob } from "@/lib/transcript/runTranscriptJob";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; trackId: string }> },
) {
  const { id, trackId } = await params;

  // Parse optional query params
  const url = new URL(req.url);
  const model =
    url.searchParams.get("model") ??
    process.env.WHISPER_DEFAULT_MODEL ??
    "small";
  const lang =
    url.searchParams.get("lang") ??
    process.env.WHISPER_DEFAULT_LANG ??
    "auto";

  // Validate project exists
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  }

  // Validate track exists
  const track = await db.audioTrack.findUnique({ where: { id: trackId } });
  if (!track) {
    return NextResponse.json({ error: "track_not_found" }, { status: 404 });
  }

  // Create the job in the registry
  const job = transcriptRegistry.create({ projectId: id, trackId });

  // Fire-and-forget; the registry is updated by runTranscriptJob on success/error
  runTranscriptJob(job.id, {
    projectId: id,
    trackId,
    model,
    language: lang,
  }).catch(() => {
    // registry already updated with error status inside runTranscriptJob
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
