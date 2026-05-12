import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { db } from "@/lib/db";
import {
  assetPath,
  extensionFor,
  ensureAssetsDir,
  publicAssetUrl,
} from "./storage";
import { classify, MAX_UPLOAD_BYTES } from "./mimeWhitelist";
import { probeContainerKind } from "./probeMediaType";

export async function processUpload(file: File) {
  const mimeType = classify(file.type);
  if (!mimeType) throw new Error(`Unsupported mime type: ${file.type}`);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File too large");

  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const ext = extensionFor(file.type, file.name);

  // Dedup
  const existing = await db.asset.findUnique({ where: { sha256 } });
  if (existing) return existing;

  // Browsers usually tag .mp4 files as video/mp4 even when they only contain
  // audio (e.g. AAC-in-MP4 podcast). Probe with ffprobe and reclassify when
  // there are no video streams so the asset shows up under the right kind.
  const type = await probeContainerKind(buf, ext, mimeType);

  await ensureAssetsDir();
  await writeFile(assetPath(sha256, ext), buf);

  return db.asset.create({
    data: {
      type,
      filename: file.name,
      path: publicAssetUrl(sha256, ext),
      mimeType: file.type,
      size: file.size,
      sha256,
    },
  });
}
