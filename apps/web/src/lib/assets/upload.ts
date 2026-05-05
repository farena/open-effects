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

export async function processUpload(file: File) {
  const type = classify(file.type);
  if (!type) throw new Error(`Unsupported mime type: ${file.type}`);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File too large");

  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const ext = extensionFor(file.type, file.name);

  // Dedup
  const existing = await db.asset.findUnique({ where: { sha256 } });
  if (existing) return existing;

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
