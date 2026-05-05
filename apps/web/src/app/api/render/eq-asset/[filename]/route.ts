import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.resolve(process.cwd(), ".cache/audio");

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename: raw } = await params;
  const filename = decodeURIComponent(raw);

  if (
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..")
  ) {
    return new Response("invalid_filename", { status: 400 });
  }

  const abs = path.join(CACHE_DIR, filename);
  if (!abs.startsWith(CACHE_DIR + path.sep)) {
    return new Response("invalid_path", { status: 400 });
  }

  const fileStat = await stat(abs).catch(() => null);
  if (!fileStat) return new Response("not_found", { status: 404 });

  const ext = path.extname(abs).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  const data = await readFile(abs);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileStat.size),
      "Cache-Control": "no-store",
    },
  });
}
