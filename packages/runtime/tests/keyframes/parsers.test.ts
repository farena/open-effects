import { describe, it, expect } from "vitest";
import { parseNumeric, parseLengthPx, parseAngleDeg, serializeNumeric, serializeLengthPx, serializeAngleDeg, lerp } from "@/keyframes/parsers";

describe("parsers", () => {
  it("parseNumeric handles ints + floats", () => {
    expect(parseNumeric("1")).toBe(1);
    expect(parseNumeric("0.5")).toBe(0.5);
    expect(parseNumeric("-2.5")).toBe(-2.5);
  });
  it("parseLengthPx strips px suffix", () => {
    expect(parseLengthPx("100px")).toBe(100);
    expect(parseLengthPx("0px")).toBe(0);
  });
  it("parseLengthPx handles bare numbers", () => {
    expect(parseLengthPx("50")).toBe(50);
  });
  it("parseAngleDeg strips deg suffix", () => {
    expect(parseAngleDeg("180deg")).toBe(180);
  });
  it("serializers round-trip", () => {
    expect(serializeNumeric(1.5)).toBe("1.5");
    expect(serializeLengthPx(100)).toBe("100px");
    expect(serializeAngleDeg(45)).toBe("45deg");
  });
  it("lerp is correct at endpoints and midpoint", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});
