import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/projects/[id]/audioTracks/[trackId]/transcript/events/route";
import { transcriptRegistry } from "@/lib/transcript/transcriptRegistry";
import type { Transcript } from "@open-effects/shared-types";

// ---------------------------------------------------------------------------
// Fixture transcript
// ---------------------------------------------------------------------------
const FIXTURE_TRANSCRIPT: Transcript = {
  language: "en",
  model: "small",
  segments: [
    {
      id: "seg-0",
      text: "Hello world.",
      startFrame: 0,
      endFrame: 30,
    },
  ],
};

// ---------------------------------------------------------------------------
// Helper: consume all SSE events from a ReadableStream
// ---------------------------------------------------------------------------
async function collectEvents(
  body: ReadableStream<Uint8Array>,
  count: number,
): Promise<Record<string, unknown>[]> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const events: Record<string, unknown>[] = [];
  let buffer = "";

  while (events.length < count) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    // Last part may be incomplete
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith("data: ")) {
        events.push(JSON.parse(line.slice(6)));
      }
    }
  }

  reader.cancel();
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/projects/:id/audioTracks/:trackId/transcript/events", () => {
  it("streams initial state then progress updates then completed event", async () => {
    const job = transcriptRegistry.create({
      projectId: "proj-sse-1",
      trackId: "track-sse-1",
    });
    const jobId = job.id;

    const req = new NextRequest(
      `http://localhost/api/projects/proj-sse-1/audioTracks/track-sse-1/transcript/events?jobId=${jobId}`,
    );

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    // Start consuming — we expect 3 events: initial (queued), transcribing, completed
    const consumePromise = collectEvents(res.body!, 3);

    // Push updates asynchronously after the consumer has started
    await Promise.resolve(); // yield to let the stream start
    transcriptRegistry.update(jobId, { status: "transcribing", progress: 0.5 });
    transcriptRegistry.update(jobId, {
      status: "completed",
      progress: 1,
      transcript: FIXTURE_TRANSCRIPT,
    });

    const events = await consumePromise;

    expect(events.length).toBeGreaterThanOrEqual(3);

    const initial = events[0];
    expect(initial.id).toBe(jobId);
    expect(initial.status).toBe("queued");
    expect(initial.progress).toBe(0);

    const transcribingEvent = events.find((e) => e.status === "transcribing");
    expect(transcribingEvent).toBeDefined();
    expect(transcribingEvent!.progress).toBe(0.5);

    const completedEvent = events.find((e) => e.status === "completed");
    expect(completedEvent).toBeDefined();
    expect(completedEvent!.progress).toBe(1);
    expect(
      (completedEvent as Record<string, unknown>).transcript,
    ).toBeDefined();
  });

  it("returns 400 when jobId query param is missing", async () => {
    const req = new NextRequest(
      "http://localhost/api/projects/proj-x/audioTracks/track-x/transcript/events",
    );

    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("returns 404 when jobId does not exist in registry", async () => {
    const req = new NextRequest(
      "http://localhost/api/projects/proj-x/audioTracks/track-x/transcript/events?jobId=nonexistent-job-id",
    );

    const res = await GET(req);

    expect(res.status).toBe(404);
  });
});
