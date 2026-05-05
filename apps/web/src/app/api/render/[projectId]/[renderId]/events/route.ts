import { renderRegistry, type RenderJob } from "@/lib/render/renderRegistry";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; renderId: string }> },
) {
  const { renderId } = await params;
  const initial = renderRegistry.get(renderId);
  if (!initial) return new Response("not_found", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // eslint-disable-next-line prefer-const
      let unsub: (() => void) | undefined;
      const send = (job: RenderJob) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(job)}\n\n`));
        if (job.status === "completed" || job.status === "error") {
          controller.close();
          unsub?.();
        }
      };
      send(initial);
      unsub = renderRegistry.subscribe(renderId, send);
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
