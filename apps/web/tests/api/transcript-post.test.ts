import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  vi,
  type MockInstance,
} from "vitest";

// Mock node:fs/promises BEFORE importing anything that uses it.
// In ESM, vi.mock is hoisted to the top of the file automatically.
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    // Replaced per-test via vi.mocked() — default is a no-op
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

import { POST } from "@/app/api/projects/[id]/audioTracks/[trackId]/transcript/route";
import { db } from "@/lib/db";
import { POST as POST_PROJECT } from "@/app/api/projects/route";
import { transcriptRegistry } from "@/lib/transcript/transcriptRegistry";
import type { TranscriptJob } from "@/lib/transcript/types";
import { readFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Whisper fixture response (3 segments, mimics whisper-asr-webservice shape)
// ---------------------------------------------------------------------------
const WHISPER_FIXTURE = {
  text: "Hello world. How are you? Goodbye.",
  language: "en",
  segments: [
    {
      id: "0",
      start: 0.0,
      end: 1.0,
      text: "Hello world.",
      words: [
        { start: 0.0, end: 0.4, word: "Hello", probability: 0.99 },
        { start: 0.4, end: 1.0, word: " world.", probability: 0.97 },
      ],
    },
    {
      id: "1",
      start: 1.5,
      end: 2.5,
      text: "How are you?",
      words: [
        { start: 1.5, end: 1.8, word: "How", probability: 0.98 },
        { start: 1.8, end: 2.1, word: " are", probability: 0.96 },
        { start: 2.1, end: 2.5, word: " you?", probability: 0.95 },
      ],
    },
    {
      id: "2",
      start: 3.0,
      end: 4.0,
      text: "Goodbye.",
      words: [
        { start: 3.0, end: 4.0, word: "Goodbye.", probability: 0.99 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedProject(name = "Transcript Test Project") {
  const req = new Request("http://localhost/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, width: 1920, height: 1080, fps: 30 }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST_PROJECT(req);
  const body = await res.json();
  return body.id as string;
}

async function seedAssetAndTrack(projectId: string) {
  const asset = await db.asset.create({
    data: {
      type: "audio",
      filename: "test.mp3",
      path: "/assets/abc123def456abc123def456abc123def456abc123def456abc123def456abc1.mp3",
      mimeType: "audio/mpeg",
      size: 4,
      sha256: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
    },
  });

  const scene = await db.scene.findFirst({ where: { projectId } });
  if (!scene) throw new Error("No scene found for project");

  const track = await db.audioTrack.create({
    data: {
      sceneId: scene.id,
      assetId: asset.id,
      startFrame: 0,
      trimStart: 0,
      trimEnd: 120,
    },
  });

  return { asset, track };
}

/** Poll transcriptRegistry until the job reaches a terminal state or timeout */
async function waitForJobTerminal(
  jobId: string,
  timeoutMs = 2000,
): Promise<TranscriptJob> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = transcriptRegistry.get(jobId);
    if (job && (job.status === "completed" || job.status === "error")) {
      return job;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  const job = transcriptRegistry.get(jobId);
  if (!job) throw new Error(`Job ${jobId} not found in registry`);
  return job;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let fetchSpy: MockInstance;
const mockedReadFile = vi.mocked(readFile);

beforeEach(async () => {
  // Clean up FK order: audioTrack → asset, scene → project
  await db.audioTrack.deleteMany();
  await db.asset.deleteMany();
  await db.project.deleteMany();

  // Mock fetch to return the Whisper fixture (avoid real HTTP call)
  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(WHISPER_FIXTURE), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  // Configure readFile mock:
  // - When called with "utf8" encoding (cache read) → throw ENOENT (cache miss)
  // - When called without encoding (binary audio read) → return dummy buffer
  mockedReadFile.mockImplementation(
    async (filePath: unknown, options?: unknown) => {
      if (options === "utf8") {
        const err = Object.assign(new Error("ENOENT: no such file"), {
          code: "ENOENT",
        });
        throw err;
      }
      // Binary read: return a minimal dummy audio buffer
      return Buffer.from([0xff, 0xfb, 0x90, 0x00]) as unknown as string;
    },
  );
});

afterAll(async () => {
  vi.restoreAllMocks();
  await db.$disconnect();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/projects/:id/audioTracks/:trackId/transcript", () => {
  it("returns 202 + { jobId } and job eventually reaches completed", async () => {
    const projectId = await seedProject();
    const { track } = await seedAssetAndTrack(projectId);

    const res = await POST(
      new Request(
        `http://localhost/api/projects/${projectId}/audioTracks/${track.id}/transcript`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: projectId, trackId: track.id }) },
    );

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toHaveProperty("jobId");
    expect(typeof body.jobId).toBe("string");
    expect(body.jobId.length).toBeGreaterThan(0);

    // Wait for the fire-and-forget job to finish
    const job = await waitForJobTerminal(body.jobId);
    expect(job.status).toBe("completed");
    expect(job.transcript).toBeDefined();
    expect(job.transcript!.segments).toHaveLength(3);
    expect(job.progress).toBe(1);
    expect(job.finishedAt).toBeDefined();
  });

  it("returns 404 when the trackId does not exist", async () => {
    const projectId = await seedProject();

    const res = await POST(
      new Request(
        `http://localhost/api/projects/${projectId}/audioTracks/non-existent-track/transcript`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({
          id: projectId,
          trackId: "non-existent-track",
        }),
      },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 404 when the project does not exist", async () => {
    const res = await POST(
      new Request(
        `http://localhost/api/projects/no-such-project/audioTracks/no-such-track/transcript`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({
          id: "no-such-project",
          trackId: "no-such-track",
        }),
      },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
