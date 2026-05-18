import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { mapWhisperResponse } from "@/lib/transcript/mapWhisperResponse";

// --- Fixture WhisperRaw response ---
const whisperFixture = {
  text: "Hello world. How are you? Fine thanks.",
  language: "en",
  segments: [
    {
      id: 0,
      start: 0.0,
      end: 2.5,
      text: "Hello world.",
      words: [
        { start: 0.0, end: 0.8, word: " Hello", probability: 0.99 },
        { start: 0.9, end: 1.5, word: " world.", probability: 0.97 },
      ],
    },
    {
      id: 1,
      start: 3.0,
      end: 5.0,
      text: "How are you?",
      words: [
        { start: 3.0, end: 3.5, word: " How", probability: 0.95 },
        { start: 3.6, end: 3.9, word: " are", probability: 0.96 },
        { start: 4.0, end: 4.8, word: " you?", probability: 0.98 },
      ],
    },
    {
      id: 2,
      start: 5.5,
      end: 7.0,
      text: "Fine thanks.",
      words: [
        { start: 5.5, end: 6.0, word: " Fine", probability: 0.99 },
        { start: 6.1, end: 7.0, word: " thanks.", probability: 0.97 },
      ],
    },
  ],
};

const MODEL = "small";
const LANGUAGE = "en";
const FPS = 30;
const ASSET_SHA =
  "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";

let tmpDir: string;
let fakeCwd: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
  fakeCwd = tmpDir;
  vi.spyOn(process, "cwd").mockReturnValue(fakeCwd);
  // Create a fake audio file in tmpdir
  await fs.writeFile(path.join(tmpDir, "audio.mp3"), Buffer.from("fakeaudio"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  // Clean up tmpdir
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("transcribeAudio — cache hit", () => {
  it("returns cached result without calling fetch and without calling onStatus", async () => {
    // Pre-populate the cache with a valid transcript
    const expectedTranscript = mapWhisperResponse(whisperFixture, FPS, MODEL);
    const { transcriptCacheKey } = await import(
      "@/lib/transcript/cacheKey"
    );
    const key = transcriptCacheKey(ASSET_SHA, MODEL, LANGUAGE);
    const cacheDir = path.join(fakeCwd, ".cache", "transcripts");
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(cacheDir, `${key}.json`),
      JSON.stringify(expectedTranscript),
    );

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const onStatus = vi.fn();

    // Dynamic import so cwd spy is in effect when the module resolves paths
    const { transcribeAudio } = await import("@/lib/transcript/whisperClient");

    const result = await transcribeAudio({
      filePath: path.join(fakeCwd, "audio.mp3"),
      assetSha: ASSET_SHA,
      model: MODEL,
      language: LANGUAGE,
      fps: FPS,
      onStatus,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalled();
    expect(result.segments).toHaveLength(3);
    expect(result.language).toBe(expectedTranscript.language);
  });
});

describe("transcribeAudio — cache miss", () => {
  it("calls fetch, fires onStatus in order, returns mapped result, writes cache file", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => whisperFixture,
    } as Response);

    const onStatus = vi.fn();

    const { transcribeAudio } = await import("@/lib/transcript/whisperClient");
    const { transcriptCacheKey } = await import(
      "@/lib/transcript/cacheKey"
    );

    const result = await transcribeAudio({
      filePath: path.join(fakeCwd, "audio.mp3"),
      assetSha: ASSET_SHA,
      model: MODEL,
      language: LANGUAGE,
      fps: FPS,
      onStatus,
    });

    // fetch was called once
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // onStatus fired with model-loading first, then transcribing
    expect(onStatus).toHaveBeenCalledTimes(2);
    expect(onStatus.mock.calls[0][0]).toBe("model-loading");
    expect(onStatus.mock.calls[1][0]).toBe("transcribing");

    // Result matches expected mapping
    const expected = mapWhisperResponse(whisperFixture, FPS, MODEL);
    expect(result.segments).toHaveLength(expected.segments.length);
    expect(result.segments[0].startFrame).toBe(expected.segments[0].startFrame);
    expect(result.segments[0].endFrame).toBe(expected.segments[0].endFrame);

    // Cache file was written
    const key = transcriptCacheKey(ASSET_SHA, MODEL, LANGUAGE);
    const cachePath = path.join(
      fakeCwd,
      ".cache",
      "transcripts",
      `${key}.json`,
    );
    const cached = JSON.parse(await fs.readFile(cachePath, "utf8"));
    expect(cached.segments).toHaveLength(3);
  });

  it("throws when fetch response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    const { transcribeAudio } = await import("@/lib/transcript/whisperClient");

    await expect(
      transcribeAudio({
        filePath: path.join(fakeCwd, "audio.mp3"),
        assetSha: ASSET_SHA,
        model: MODEL,
        language: LANGUAGE,
        fps: FPS,
      }),
    ).rejects.toThrow();
  });

  it("builds fetch URL without language param when language is 'auto'", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => whisperFixture,
    } as Response);

    const { transcribeAudio } = await import("@/lib/transcript/whisperClient");

    await transcribeAudio({
      filePath: path.join(fakeCwd, "audio.mp3"),
      assetSha: ASSET_SHA,
      model: MODEL,
      language: "auto",
      fps: FPS,
    });

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("&language=");
  });

  it("builds fetch URL with language param when language is a specific code", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => whisperFixture,
    } as Response);

    const { transcribeAudio } = await import("@/lib/transcript/whisperClient");

    await transcribeAudio({
      filePath: path.join(fakeCwd, "audio.mp3"),
      assetSha: ASSET_SHA,
      model: MODEL,
      language: "fr",
      fps: FPS,
    });

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("&language=fr");
  });
});
