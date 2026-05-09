import { describe, it, expect } from "vitest";
import { computeCustomValuesAtFrame } from "@/keyframes/computeCustomValuesAtFrame";
import type { Keyframe } from "@open-effects/shared-types";

const linear = { type: "linear" as const };

describe("computeCustomValuesAtFrame", () => {
  it("returns empty when no keyframes", () => {
    expect(computeCustomValuesAtFrame([], 0, 30)).toEqual({});
  });

  it("ignores non-custom keyframes", () => {
    const kfs: Keyframe[] = [
      { frame: 0, property: "opacity", value: "0", easingOut: linear },
      { frame: 10, property: "opacity", value: "1", easingOut: linear },
    ];
    expect(computeCustomValuesAtFrame(kfs, 5, 30)).toEqual({});
  });

  it("interpolates a single custom key linearly between two keyframes", () => {
    const kfs: Keyframe[] = [
      { frame: 0, property: "custom.POSITION_X", value: "0", easingOut: linear },
      { frame: 50, property: "custom.POSITION_X", value: "100", easingOut: linear },
    ];
    const v = computeCustomValuesAtFrame(kfs, 25, 30);
    expect(Number(v.POSITION_X)).toBeCloseTo(50, 5);
  });

  it("clamps before the first keyframe", () => {
    const kfs: Keyframe[] = [
      { frame: 10, property: "custom.X", value: "5", easingOut: linear },
      { frame: 30, property: "custom.X", value: "20", easingOut: linear },
    ];
    expect(computeCustomValuesAtFrame(kfs, 0, 30).X).toBe("5");
  });

  it("clamps after the last keyframe", () => {
    const kfs: Keyframe[] = [
      { frame: 0, property: "custom.X", value: "5", easingOut: linear },
      { frame: 10, property: "custom.X", value: "20", easingOut: linear },
    ];
    expect(computeCustomValuesAtFrame(kfs, 60, 30).X).toBe("20");
  });

  it("interpolates multiple keys independently", () => {
    const kfs: Keyframe[] = [
      { frame: 0, property: "custom.X", value: "0", easingOut: linear },
      { frame: 10, property: "custom.X", value: "10", easingOut: linear },
      { frame: 0, property: "custom.Y", value: "100", easingOut: linear },
      { frame: 10, property: "custom.Y", value: "200", easingOut: linear },
    ];
    const v = computeCustomValuesAtFrame(kfs, 5, 30);
    expect(Number(v.X)).toBeCloseTo(5, 5);
    expect(Number(v.Y)).toBeCloseTo(150, 5);
  });

  it("supports decimal interpolated values", () => {
    const kfs: Keyframe[] = [
      { frame: 0, property: "custom.K", value: "0", easingOut: linear },
      { frame: 4, property: "custom.K", value: "1", easingOut: linear },
    ];
    expect(Number(computeCustomValuesAtFrame(kfs, 1, 30).K)).toBeCloseTo(0.25, 5);
  });
});
