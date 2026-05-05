import { describe, it, expect } from "vitest";
import { evalEasing } from "@/keyframes/easings";
import type { Easing } from "@open-effects/shared-types";
const fps = 30;

describe("evalEasing", () => {
  it("linear at endpoints", () => {
    const e: Easing = { type: "linear" };
    expect(evalEasing(e, 0, 30, fps)).toBe(0);
    expect(evalEasing(e, 30, 30, fps)).toBe(1);
  });
  it("linear midpoint", () => {
    expect(evalEasing({ type: "linear" }, 15, 30, fps)).toBeCloseTo(0.5, 5);
  });
  it("cubic-bezier ease-out approximation", () => {
    const e: Easing = { type: "cubic-bezier", params: [0, 0, 0.58, 1] };
    const v = evalEasing(e, 15, 30, fps);
    expect(v).toBeGreaterThan(0.5); // ease-out: more progress at midpoint
  });
  it("ease-in: less progress at midpoint", () => {
    const v = evalEasing({ type: "ease-in" }, 15, 30, fps);
    expect(v).toBeLessThan(0.5);
  });
  it("spring at frame 0 = 0", () => {
    const e: Easing = { type: "spring", params: { damping: 12, stiffness: 100, mass: 1 } };
    expect(evalEasing(e, 0, 30, fps)).toBeCloseTo(0, 5);
  });
  it("spring approaches 1 by end of segment", () => {
    const e: Easing = { type: "spring", params: { damping: 12, stiffness: 100, mass: 1 } };
    const v = evalEasing(e, 30, 30, fps);
    expect(v).toBeGreaterThan(0.95); // approximately settled
  });
  it("guards against zero-length segment", () => {
    expect(evalEasing({ type: "linear" }, 0, 0, fps)).toBe(1);
  });
});
