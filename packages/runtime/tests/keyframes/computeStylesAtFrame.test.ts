import { describe, it, expect } from "vitest";
import { computeStylesAtFrame } from "@/keyframes/computeStylesAtFrame";
import type { Keyframe } from "@open-effects/shared-types";

const linear = { type: "linear" as const };

describe("computeStylesAtFrame", () => {
  it("returns empty object when no keyframes", () => {
    expect(computeStylesAtFrame([], 0, 30)).toEqual({});
  });

  it("opacity 0→1 linear at midpoint = 0.5", () => {
    const kfs: Keyframe[] = [
      { frame: 0, property: "opacity", value: "0", easingOut: linear },
      { frame: 30, property: "opacity", value: "1", easingOut: linear }
    ];
    const styles = computeStylesAtFrame(kfs, 15, 30);
    expect(Number(styles.opacity)).toBeCloseTo(0.5, 5);
  });

  it("clamps before first keyframe", () => {
    const kfs: Keyframe[] = [
      { frame: 10, property: "opacity", value: "0.5", easingOut: linear },
      { frame: 30, property: "opacity", value: "1", easingOut: linear }
    ];
    const styles = computeStylesAtFrame(kfs, 0, 30);
    expect(Number(styles.opacity)).toBe(0.5);
  });

  it("clamps after last keyframe", () => {
    const kfs: Keyframe[] = [
      { frame: 0, property: "opacity", value: "0", easingOut: linear },
      { frame: 30, property: "opacity", value: "1", easingOut: linear }
    ];
    const styles = computeStylesAtFrame(kfs, 60, 30);
    expect(Number(styles.opacity)).toBe(1);
  });

  it("composes multi-property transform", () => {
    const kfs: Keyframe[] = [
      { frame: 0, property: "transform.translateX", value: "0px", easingOut: linear },
      { frame: 30, property: "transform.translateX", value: "100px", easingOut: linear },
      { frame: 0, property: "transform.scale", value: "1", easingOut: linear },
      { frame: 30, property: "transform.scale", value: "2", easingOut: linear }
    ];
    const styles = computeStylesAtFrame(kfs, 15, 30);
    expect(styles.transform).toContain("translate(50px, 0px)");
    expect(styles.transform).toContain("scale(1.5)");
  });

  it("interpolates color via popmotion", () => {
    const kfs: Keyframe[] = [
      { frame: 0, property: "background-color", value: "rgba(255,0,0,1)", easingOut: linear },
      { frame: 30, property: "background-color", value: "rgba(0,0,255,1)", easingOut: linear }
    ];
    const styles = computeStylesAtFrame(kfs, 15, 30);
    expect(styles.backgroundColor).toMatch(/rgba/);
  });

  it("supports spring easing between two keyframes", () => {
    const kfs: Keyframe[] = [
      { frame: 0, property: "opacity", value: "0", easingOut: { type: "spring", params: { damping: 12, stiffness: 100, mass: 1 } } },
      { frame: 30, property: "opacity", value: "1", easingOut: linear }
    ];
    const at15 = Number(computeStylesAtFrame(kfs, 15, 30).opacity);
    // spring is non-linear; at midpoint should NOT be 0.5
    expect(at15).not.toBeCloseTo(0.5, 1);
  });
});
