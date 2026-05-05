import { describe, it, expect } from "vitest";
import { evalVolumeAtFrame } from "@/keyframes/evalVolumeAtFrame";
import type { VolumeKeyframe } from "@open-effects/shared-types";

const linear = { type: "linear" as const };
const fps = 30;

describe("evalVolumeAtFrame", () => {
  it("empty volumeKeyframes returns 1", () => {
    expect(evalVolumeAtFrame([], 0, fps)).toBe(1);
  });

  it("one keyframe returns its value at any frame", () => {
    const kfs: VolumeKeyframe[] = [
      { frame: 10, value: 0.75, easingOut: linear },
    ];
    expect(evalVolumeAtFrame(kfs, 0, fps)).toBe(0.75);
    expect(evalVolumeAtFrame(kfs, 10, fps)).toBe(0.75);
    expect(evalVolumeAtFrame(kfs, 50, fps)).toBe(0.75);
  });

  it("linear interpolation at midpoint returns ~0.5", () => {
    const kfs: VolumeKeyframe[] = [
      { frame: 0, value: 0, easingOut: linear },
      { frame: 30, value: 1, easingOut: linear },
    ];
    expect(evalVolumeAtFrame(kfs, 15, fps)).toBeCloseTo(0.5, 5);
  });

  it("clamps before first keyframe", () => {
    const kfs: VolumeKeyframe[] = [
      { frame: 10, value: 0.3, easingOut: linear },
      { frame: 30, value: 1, easingOut: linear },
    ];
    expect(evalVolumeAtFrame(kfs, 0, fps)).toBe(0.3);
  });

  it("clamps after last keyframe", () => {
    const kfs: VolumeKeyframe[] = [
      { frame: 0, value: 0, easingOut: linear },
      { frame: 30, value: 0.8, easingOut: linear },
    ];
    expect(evalVolumeAtFrame(kfs, 60, fps)).toBe(0.8);
  });

  it("spring easing produces non-linear midpoint", () => {
    const spring = {
      type: "spring" as const,
      params: { damping: 12, stiffness: 100, mass: 1 },
    };
    const kfs: VolumeKeyframe[] = [
      { frame: 0, value: 0, easingOut: spring },
      { frame: 30, value: 1, easingOut: linear },
    ];
    const at15 = evalVolumeAtFrame(kfs, 15, fps);
    // spring is non-linear; midpoint should differ from 0.5
    expect(at15).not.toBeCloseTo(0.5, 1);
  });

  it("zero-length segment (two kfs at same frame) returns second value", () => {
    const kfs: VolumeKeyframe[] = [
      { frame: 10, value: 0.2, easingOut: linear },
      { frame: 10, value: 0.9, easingOut: linear },
    ];
    expect(evalVolumeAtFrame(kfs, 10, fps)).toBe(0.9);
  });
});
