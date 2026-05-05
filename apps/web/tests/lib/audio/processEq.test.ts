import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { processEq } from "@/lib/audio/processEq";
import { hasFfmpeg } from "@/lib/audio/ffmpegBin";
import type { Eq } from "@open-effects/shared-types";

const FIXTURE_PATH = path.resolve(__dirname, "../../fixtures/test.mp3");

const SHA = "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";
const CACHE_DIR = path.resolve(process.cwd(), ".cache/audio");

afterEach(() => {
  // Clean up any cached files created during tests
  if (existsSync(CACHE_DIR)) {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe("processEq — bypass cases (no FFmpeg required)", () => {
  it("returns inputAbsPath unchanged when eq is null", async () => {
    const result = await processEq({
      inputAbsPath: "/any/path/audio.mp3",
      assetSha256: SHA,
      eq: null,
    });
    expect(result).toBe("/any/path/audio.mp3");
  });

  it("returns inputAbsPath unchanged when eq is undefined", async () => {
    const result = await processEq({
      inputAbsPath: "/any/path/audio.mp3",
      assetSha256: SHA,
      eq: undefined,
    });
    expect(result).toBe("/any/path/audio.mp3");
  });

  it("returns inputAbsPath unchanged when all gains are 0", async () => {
    const eq: Eq = { low: 0, mid: 0, high: 0, presence: 0 };
    const result = await processEq({
      inputAbsPath: "/any/path/audio.mp3",
      assetSha256: SHA,
      eq,
    });
    expect(result).toBe("/any/path/audio.mp3");
  });
});

describe("processEq — FFmpeg-dependent cases", () => {
  it.skipIf(!hasFfmpeg() || !existsSync(FIXTURE_PATH))(
    "non-zero gains → returns a path under .cache/audio/ and file exists",
    async () => {
      const eq: Eq = { low: 3, mid: 0, high: -2, presence: 0 };
      const result = await processEq({
        inputAbsPath: FIXTURE_PATH,
        assetSha256: SHA,
        eq,
      });
      expect(result).toContain(".cache/audio/");
      expect(existsSync(result)).toBe(true);
      const { statSync } = await import("node:fs");
      expect(statSync(result).size).toBeGreaterThan(0);
    },
  );

  it.skipIf(!hasFfmpeg() || !existsSync(FIXTURE_PATH))(
    "second call with same params returns same path without re-invoking FFmpeg",
    async () => {
      const eq: Eq = { low: 3, mid: 0, high: -2, presence: 0 };
      const opts = { inputAbsPath: FIXTURE_PATH, assetSha256: SHA, eq };

      // First call — runs FFmpeg
      const first = await processEq(opts);
      const { statSync } = await import("node:fs");
      const mtime1 = statSync(first).mtimeMs;

      // Spy on spawnSync to confirm it is NOT called on second run
      const childProcess = await import("node:child_process");
      const spy = vi.spyOn(childProcess, "spawnSync");

      const second = await processEq(opts);
      expect(second).toBe(first);
      expect(spy).not.toHaveBeenCalled();

      // mtime should be stable (file not touched)
      const mtime2 = statSync(first).mtimeMs;
      expect(mtime2).toBe(mtime1);
    },
  );

  it.skipIf(!hasFfmpeg() || !existsSync(FIXTURE_PATH))(
    "different gains produce a different output path",
    async () => {
      const eq1: Eq = { low: 3, mid: 0, high: -2, presence: 0 };
      const eq2: Eq = { low: 5, mid: 2, high: 0, presence: -1 };

      const path1 = await processEq({
        inputAbsPath: FIXTURE_PATH,
        assetSha256: SHA,
        eq: eq1,
      });
      const path2 = await processEq({
        inputAbsPath: FIXTURE_PATH,
        assetSha256: SHA,
        eq: eq2,
      });

      expect(path1).not.toBe(path2);
    },
  );
});
