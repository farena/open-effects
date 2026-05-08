import { describe, it, expect } from "vitest";
import { mapTransitionToPreset } from "@/components/transitions";
import type { Transition } from "@open-effects/shared-types";

describe("mapTransitionToPreset", () => {
  it('returns null for "none"', () => {
    const t: Transition = { type: "none", durationFrames: 15 };
    expect(mapTransitionToPreset(t)).toBeNull();
  });

  it('returns presentation + timing for "fade"', () => {
    const t: Transition = { type: "fade", durationFrames: 15 };
    const result = mapTransitionToPreset(t);
    expect(result).not.toBeNull();
    expect(result!.presentation).toBeDefined();
    expect(result!.timing).toBeDefined();
  });

  it.each([
    "slide-left",
    "slide-right",
    "slide-up",
    "slide-down",
  ] as const)('returns presentation + timing for "%s"', (type) => {
    const t: Transition = { type, durationFrames: 20 };
    const result = mapTransitionToPreset(t);
    expect(result).not.toBeNull();
    expect(result!.presentation).toBeDefined();
    expect(result!.timing).toBeDefined();
  });

  it("forwards durationFrames into the timing config", () => {
    const t: Transition = { type: "fade", durationFrames: 42 };
    const result = mapTransitionToPreset(t);
    expect(result).not.toBeNull();
    expect(result!.timing.getDurationInFrames({ fps: 30 })).toBe(42);
  });
});
