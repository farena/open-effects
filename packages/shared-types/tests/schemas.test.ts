import { describe, it, expect } from "vitest";
import { EasingSchema } from "@/schemas/easing";
describe("EasingSchema", () => {
  it("accepts linear", () => {
    expect(EasingSchema.safeParse({ type: "linear" }).success).toBe(true);
  });
  it("accepts cubic-bezier with 4 params", () => {
    expect(EasingSchema.safeParse({ type: "cubic-bezier", params: [0.25, 0.1, 0.25, 1] }).success).toBe(true);
  });
  it("accepts spring with damping/stiffness/mass", () => {
    expect(EasingSchema.safeParse({ type: "spring", params: { damping: 10, stiffness: 100, mass: 1 } }).success).toBe(true);
  });
  it("rejects unknown type", () => {
    expect(EasingSchema.safeParse({ type: "magic" }).success).toBe(false);
  });
  it("rejects cubic-bezier with wrong arity", () => {
    expect(EasingSchema.safeParse({ type: "cubic-bezier", params: [0, 1] }).success).toBe(false);
  });
});
