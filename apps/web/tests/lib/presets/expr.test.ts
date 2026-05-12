import { describe, it, expect } from "vitest";
import {
  evaluateExpression,
  evaluateTemplate,
  formatNumber,
  PresetExpressionError,
} from "@/lib/presets/expr";

describe("evaluateExpression", () => {
  it("evaluates numeric literals", () => {
    expect(evaluateExpression("42", {})).toBe(42);
    expect(evaluateExpression("3.14", {})).toBe(3.14);
  });

  it("resolves variables from vars", () => {
    expect(evaluateExpression("x", { x: 7 })).toBe(7);
  });

  it("coerces string-valued vars to numbers", () => {
    expect(evaluateExpression("x + 1", { x: "10" })).toBe(11);
  });

  it("supports + - * /", () => {
    expect(evaluateExpression("1 + 2", {})).toBe(3);
    expect(evaluateExpression("10 - 4", {})).toBe(6);
    expect(evaluateExpression("3 * 4", {})).toBe(12);
    expect(evaluateExpression("10 / 4", {})).toBe(2.5);
  });

  it("honors operator precedence", () => {
    expect(evaluateExpression("2 + 3 * 4", {})).toBe(14);
    expect(evaluateExpression("(2 + 3) * 4", {})).toBe(20);
  });

  it("supports unary minus", () => {
    expect(evaluateExpression("-x", { x: 5 })).toBe(-5);
    expect(evaluateExpression("-(x + 1)", { x: 2 })).toBe(-3);
  });

  it("supports the function round/floor/ceil/abs", () => {
    expect(evaluateExpression("round(2.6)", {})).toBe(3);
    expect(evaluateExpression("floor(2.9)", {})).toBe(2);
    expect(evaluateExpression("ceil(2.1)", {})).toBe(3);
    expect(evaluateExpression("abs(-5)", {})).toBe(5);
  });

  it("supports min/max with multiple args", () => {
    expect(evaluateExpression("min(3, 7, 2)", {})).toBe(2);
    expect(evaluateExpression("max(3, 7, 2)", {})).toBe(7);
  });

  it("evaluates the swing-style amplitude * 0.6 idiom", () => {
    expect(evaluateExpression("-round(amplitude * 0.6)", { amplitude: 15 })).toBe(
      -9,
    );
  });

  it("throws on unknown variable", () => {
    expect(() => evaluateExpression("oops", {})).toThrow(
      PresetExpressionError,
    );
  });

  it("throws on unknown function", () => {
    expect(() => evaluateExpression("nope(1)", {})).toThrow(
      PresetExpressionError,
    );
  });

  it("throws on division by zero", () => {
    expect(() => evaluateExpression("1 / 0", {})).toThrow(
      PresetExpressionError,
    );
  });
});

describe("formatNumber", () => {
  it("prints integers without a decimal point", () => {
    expect(formatNumber(5)).toBe("5");
    expect(formatNumber(-3)).toBe("-3");
  });

  it("preserves typical decimal values", () => {
    expect(formatNumber(0.5)).toBe("0.5");
    expect(formatNumber(1.1)).toBe("1.1");
  });

  it("squashes floating-point noise (0.1 + 0.2)", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
  });
});

describe("evaluateTemplate", () => {
  it("returns literal strings verbatim", () => {
    expect(evaluateTemplate("0px", {})).toBe("0px");
  });

  it("substitutes a single placeholder", () => {
    expect(evaluateTemplate("${x}px", { x: -300 })).toBe("-300px");
  });

  it("substitutes multiple placeholders", () => {
    expect(evaluateTemplate("${a},${b}", { a: 1, b: 2 })).toBe("1,2");
  });

  it("evaluates expressions inside the placeholder", () => {
    expect(evaluateTemplate("${peak / 2}px", { peak: -30 })).toBe("-15px");
    expect(evaluateTemplate("${-amplitude}deg", { amplitude: 8 })).toBe("-8deg");
  });

  it("throws on an unterminated placeholder", () => {
    expect(() => evaluateTemplate("${oops", { x: 1 })).toThrow(
      PresetExpressionError,
    );
  });
});
