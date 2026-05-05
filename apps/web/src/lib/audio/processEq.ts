import { spawnSync } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { ffmpegPath } from "./ffmpegBin";
import { ffmpegEqArgs } from "./ffmpegArgs";
import { eqCacheKey } from "./cacheKey";
import type { Eq } from "@open-effects/shared-types";

const CACHE_DIR = path.resolve(process.cwd(), ".cache/audio");

function isBypass(eq: Eq | null | undefined): boolean {
  if (!eq) return true;
  return eq.low === 0 && eq.mid === 0 && eq.high === 0 && eq.presence === 0;
}

/**
 * Returns the path that should be passed to <Audio src> at render time.
 * - Bypass → returns inputAbsPath unchanged.
 * - Otherwise → ensures a cached EQ'd file exists and returns its path.
 */
export async function processEq(opts: {
  inputAbsPath: string;
  assetSha256: string;
  eq: Eq | null | undefined;
}): Promise<string> {
  if (isBypass(opts.eq)) return opts.inputAbsPath;
  const eq = opts.eq!;
  const ext = path.extname(opts.inputAbsPath) || ".mp3";
  const key = eqCacheKey(opts.assetSha256, eq);
  const out = path.join(CACHE_DIR, `${key}${ext}`);
  try {
    await stat(out);
    return out; // cache hit
  } catch {
    /* miss */
  }
  await mkdir(CACHE_DIR, { recursive: true });
  const result = spawnSync(
    ffmpegPath(),
    ffmpegEqArgs(opts.inputAbsPath, out, eq),
    { stdio: "pipe", encoding: "utf8" },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `FFmpeg failed: ${result.stderr || result.stdout || "unknown"}`,
    );
  }
  return out;
}
