import { describe, it, expect } from "vitest";
import { scopeCss } from "@/lib/scopeCss";
describe("scopeCss", () => {
  it("prefixes simple selectors", () => {
    const out = scopeCss(".card { color: red; }", "[data-layer-id=\"L1\"]");
    expect(out).toContain('[data-layer-id="L1"] .card');
  });
  it("prefixes element selectors", () => {
    const out = scopeCss("p { margin: 0; }", "[data-layer-id=\"L1\"]");
    expect(out).toContain('[data-layer-id="L1"] p');
  });
  it("does not prefix @keyframes", () => {
    const out = scopeCss("@keyframes spin { from { rotate: 0 } to { rotate: 360deg } }", "[data-layer-id=\"L1\"]");
    expect(out).toContain("@keyframes spin");
    expect(out).not.toContain('[data-layer-id="L1"] @keyframes');
  });
  it("returns empty string for empty input", () => {
    expect(scopeCss("", "[data-layer-id=\"L1\"]")).toBe("");
  });
  it("handles invalid CSS gracefully", () => {
    expect(() => scopeCss("not css {{{ ", "[data-layer-id=\"L1\"]")).not.toThrow();
  });
});
