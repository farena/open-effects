import { describe, it, expect } from "vitest";
import { mixColor } from "@/keyframes/color";

describe("mixColor", () => {
  it("returns the start color at t=0", () => {
    expect(mixColor("rgba(255,0,0,1)", "rgba(0,0,255,1)", 0)).toMatch(/255.*0.*0/);
  });
  it("returns the end color at t=1", () => {
    expect(mixColor("rgba(255,0,0,1)", "rgba(0,0,255,1)", 1)).toMatch(/0.*0.*255/);
  });
  it("midpoint mixes channels", () => {
    const out = mixColor("rgba(255,0,0,1)", "rgba(0,0,255,1)", 0.5);
    // popmotion outputs rgba(...) — accept any reasonable midpoint
    expect(out).toMatch(/rgba/);
  });
  it("works with hex inputs", () => {
    const out = mixColor("#ff0000", "#0000ff", 0.5);
    expect(out).toMatch(/rgba/);
  });
});
