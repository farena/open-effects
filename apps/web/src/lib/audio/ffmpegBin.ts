import { spawnSync } from "node:child_process";

let cached: string | null = null;
export function ffmpegPath(): string {
  if (cached) return cached;
  const probe = spawnSync(process.env.FFMPEG_PATH ?? "ffmpeg", ["-version"], {
    encoding: "utf8",
  });
  if (probe.error || probe.status !== 0) {
    throw new Error(
      "FFmpeg not found in PATH (set FFMPEG_PATH or install ffmpeg).",
    );
  }
  cached = process.env.FFMPEG_PATH ?? "ffmpeg";
  return cached;
}

export function hasFfmpeg(): boolean {
  try {
    ffmpegPath();
    return true;
  } catch {
    return false;
  }
}
