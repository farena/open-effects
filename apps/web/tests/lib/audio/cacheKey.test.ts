import { describe, it, expect } from "vitest";
import { eqCacheKey } from "@/lib/audio/cacheKey";
import type { Eq } from "@open-effects/shared-types";

const SHA = "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";
const SHA2 = "000000def456abc123def456abc123def456abc123def456abc123def456abc1";

const baseEq: Eq = { low: 0, mid: 0, high: 0, presence: 0 };

describe("eqCacheKey", () => {
  it("same (assetSha, eq) produces the same key", () => {
    const eq: Eq = { low: 3, mid: -2, high: 1, presence: 0 };
    expect(eqCacheKey(SHA, eq)).toBe(eqCacheKey(SHA, eq));
  });

  it("different gain produces a different key", () => {
    const eq1: Eq = { low: 0, mid: 0, high: 0, presence: 0 };
    const eq2: Eq = { low: 0.5, mid: 0, high: 0, presence: 0 };
    expect(eqCacheKey(SHA, eq1)).not.toBe(eqCacheKey(SHA, eq2));
  });

  it("different assetSha produces a different key", () => {
    expect(eqCacheKey(SHA, baseEq)).not.toBe(eqCacheKey(SHA2, baseEq));
  });

  it("reordering keys in the eq object literal does NOT change the key (canonical serialization)", () => {
    const eq1: Eq = { high: 1, mid: 0, low: 0, presence: 0 };
    const eq2: Eq = { low: 0, mid: 0, high: 1, presence: 0 };
    expect(eqCacheKey(SHA, eq1)).toBe(eqCacheKey(SHA, eq2));
  });

  it("tiny float drift handled by integer-dB×10 quantization", () => {
    const eq1: Eq = { low: 3.0001, mid: 0, high: 0, presence: 0 };
    const eq2: Eq = { low: 3, mid: 0, high: 0, presence: 0 };
    // Math.round(3.0001 * 10) === 30 === Math.round(3 * 10)
    expect(Math.round(3.0001 * 10)).toBe(30);
    expect(eqCacheKey(SHA, eq1)).toBe(eqCacheKey(SHA, eq2));
  });
});
