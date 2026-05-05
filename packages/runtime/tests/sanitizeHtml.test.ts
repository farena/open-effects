import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
describe("sanitizeHtml", () => {
  it("removes <script>", () => {
    expect(sanitizeHtml("<div>ok</div><script>alert(1)</script>")).not.toMatch(/script/i);
  });
  it("removes onclick handlers", () => {
    expect(sanitizeHtml('<div onclick="x()">hi</div>')).not.toMatch(/onclick/i);
  });
  it("removes javascript: URLs", () => {
    expect(sanitizeHtml('<a href="javascript:x()">x</a>')).not.toMatch(/javascript:/i);
  });
  it("preserves class, style, data-*", () => {
    const out = sanitizeHtml('<div class="a" style="color:red" data-x="1">x</div>');
    expect(out).toMatch(/class="a"/);
    expect(out).toMatch(/style="color:red"/);
    expect(out).toMatch(/data-x="1"/);
  });
  it("preserves nested structure", () => {
    const out = sanitizeHtml("<div><p>hello <strong>world</strong></p></div>");
    expect(out).toMatch(/<strong>world<\/strong>/);
  });
});
