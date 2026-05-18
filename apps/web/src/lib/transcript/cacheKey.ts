import { createHash } from "node:crypto";

export function transcriptCacheKey(
  assetSha: string,
  model: string,
  language: string,
): string {
  return createHash("sha256")
    .update(`${assetSha}:${model}:${language}`)
    .digest("hex");
}
