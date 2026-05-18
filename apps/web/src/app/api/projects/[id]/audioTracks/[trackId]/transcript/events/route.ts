import { transcriptRegistry } from "@/lib/transcript/transcriptRegistry";
import type { TranscriptJob } from "@/lib/transcript/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return new Response(JSON.stringify({ error: "missing_jobId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const initial = transcriptRegistry.get(jobId);
  if (!initial) {
    return new Response(JSON.stringify({ error: "job_not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // eslint-disable-next-line prefer-const
      let unsub: (() => void) | undefined;
      const send = (job: TranscriptJob) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(job)}\n\n`));
        if (job.status === "completed" || job.status === "error") {
          controller.close();
          unsub?.();
        }
      };
      send(initial);
      unsub = transcriptRegistry.subscribe(jobId, send);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
