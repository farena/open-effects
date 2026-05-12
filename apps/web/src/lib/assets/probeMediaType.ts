import { spawn } from "node:child_process";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { hasFfmpeg, ffmpegPath } from "@/lib/audio/ffmpegBin";

function ffprobeBinary(): string {
  const ffmpeg = ffmpegPath();
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  if (ffmpeg.endsWith("ffmpeg")) {
    return ffmpeg.slice(0, -"ffmpeg".length) + "ffprobe";
  }
  return "ffprobe";
}

async function runFfprobe(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = spawn(ffprobeBinary(), [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "csv=p=0",
      file,
    ]);
    let out = "";
    let err = "";
    ps.stdout.on("data", (b) => (out += b.toString()));
    ps.stderr.on("data", (b) => (err += b.toString()));
    ps.on("error", reject);
    ps.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err || `ffprobe exit ${code}`));
    });
  });
}

/**
 * For containers like .mp4 / .m4a that can carry audio only, check whether
 * the file actually has a video stream. Returns "video" when at least one
 * video stream exists, "audio" otherwise. Falls back to the provided
 * mimeBasedType when ffprobe is unavailable or fails.
 */
export async function probeContainerKind(
  buf: Buffer,
  ext: string,
  mimeBasedType: "image" | "audio" | "video" | "font",
): Promise<"image" | "audio" | "video" | "font"> {
  if (mimeBasedType !== "video" && mimeBasedType !== "audio") {
    return mimeBasedType;
  }
  if (!hasFfmpeg()) return mimeBasedType;

  const dir = await mkdtemp(path.join(os.tmpdir(), "oe-probe-"));
  const tmp = path.join(dir, `probe${ext.startsWith(".") ? ext : `.${ext}`}`);
  await writeFile(tmp, buf);
  try {
    const out = await runFfprobe(tmp);
    return out.includes("video") ? "video" : "audio";
  } catch {
    return mimeBasedType;
  } finally {
    try {
      await unlink(tmp);
    } catch {
      /* ignore */
    }
  }
}
