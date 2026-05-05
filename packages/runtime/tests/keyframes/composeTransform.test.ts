import { describe, it, expect } from "vitest";
import { composeTransform } from "@/keyframes/composeTransform";

describe("composeTransform", () => {
  it("empty parts returns empty string", () => {
    expect(composeTransform({})).toBe("");
  });

  it("single axis translateX produces translate with 0px for Y", () => {
    expect(composeTransform({ translateX: "100px" })).toBe("translate(100px, 0px)");
  });

  it("both axes produce translate with both values", () => {
    expect(composeTransform({ translateX: "100px", translateY: "50px" })).toBe("translate(100px, 50px)");
  });

  it("full composition produces translate scale rotate in order", () => {
    expect(
      composeTransform({ translateX: "10px", scale: "1.5", rotate: "45deg" })
    ).toBe("translate(10px, 0px) scale(1.5) rotate(45deg)");
  });
});
