import path from "node:path";
import { mkdir } from "node:fs/promises";

export const ASSETS_DIR = path.resolve(process.cwd(), "public/assets");

export async function ensureAssetsDir() {
  await mkdir(ASSETS_DIR, { recursive: true });
}

export function assetPath(sha256: string, extension: string) {
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return path.join(ASSETS_DIR, `${sha256}${ext}`);
}

export function publicAssetUrl(sha256: string, extension: string) {
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return `/assets/${sha256}${ext}`;
}

export function extensionFor(mime: string, filename: string): string {
  const fromName = path.extname(filename);
  if (fromName) return fromName.toLowerCase();
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "font/woff": ".woff",
    "font/woff2": ".woff2",
  };
  return map[mime] ?? ".bin";
}
