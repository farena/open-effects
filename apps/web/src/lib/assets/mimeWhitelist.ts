export const MIME_WHITELIST: Record<
  string,
  "image" | "audio" | "video" | "font"
> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/svg+xml": "image",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/mp4": "audio",
  "audio/aac": "audio",
  "video/mp4": "video",
  "video/webm": "video",
  "font/woff": "font",
  "font/woff2": "font",
};
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB
export function classify(mime: string) {
  return MIME_WHITELIST[mime] ?? null;
}
