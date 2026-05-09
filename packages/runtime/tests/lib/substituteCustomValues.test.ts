import { describe, it, expect } from "vitest";
import { substituteCustomValues } from "@/lib/substituteCustomValues";

describe("substituteCustomValues", () => {
  it("returns the original string when there are no values", () => {
    expect(substituteCustomValues("hello $X", {})).toBe("hello $X");
  });

  it("replaces a single $KEY occurrence", () => {
    expect(substituteCustomValues("translateX($X)", { X: "42" })).toBe(
      "translateX(42)",
    );
  });

  it("replaces multiple keys in the same template", () => {
    const css = ".card { transform: translate($Xpx, $Ypx); }";
    expect(substituteCustomValues(css, { X: "10", Y: "20" })).toBe(
      ".card { transform: translate(10px, 20px); }",
    );
  });

  it("leaves $KEY as-is when the key is not in the map", () => {
    expect(substituteCustomValues("v=$MISSING done", { OTHER: "1" })).toBe(
      "v=$MISSING done",
    );
  });

  it("does not match lowercase $foo (must start with uppercase)", () => {
    expect(substituteCustomValues("$foo and $BAR", { foo: "x", BAR: "y" })).toBe(
      "$foo and y",
    );
  });

  it("matches keys that contain digits and underscores", () => {
    expect(
      substituteCustomValues("$POS_1 + $POS_2", { POS_1: "a", POS_2: "b" }),
    ).toBe("a + b");
  });

  it("greedily matches the longest legal key", () => {
    // $POSITION_X should be consumed as a whole, not as $POSITION + _X
    expect(
      substituteCustomValues("$POSITION_X", { POSITION_X: "99", POSITION: "1" }),
    ).toBe("99");
  });

  it("returns empty string unchanged", () => {
    expect(substituteCustomValues("", { X: "1" })).toBe("");
  });
});
