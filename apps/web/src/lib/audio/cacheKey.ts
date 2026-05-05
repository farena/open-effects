import { createHash } from "node:crypto";
import type { Eq } from "@open-effects/shared-types";

export function eqCacheKey(assetSha256: string, eq: Eq): string {
  const canonical = [eq.low, eq.mid, eq.high, eq.presence]
    .map((g) => Math.round(g * 10))
    .join("|");
  return createHash("sha256")
    .update(`${assetSha256}:${canonical}`)
    .digest("hex");
}
