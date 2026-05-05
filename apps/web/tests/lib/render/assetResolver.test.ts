import path from "node:path";
import { describe, it, expect } from "vitest";
import { resolveAssetForRender } from "@/lib/render/assetResolver";

describe("resolveAssetForRender", () => {
  it("resolves /assets/abc.mp3 to an absolute path under public/assets/", () => {
    const result = resolveAssetForRender("/assets/abc.mp3");
    const expected = path.resolve(process.cwd(), "public/assets/abc.mp3");
    expect(result).toBe(expected);
  });

  it("throws on path traversal with ..", () => {
    expect(() => resolveAssetForRender("/assets/../etc/passwd")).toThrow(
      "Path traversal blocked",
    );
  });

  it("returns file:// URLs unchanged", () => {
    const url = "file:///abs/path/to/audio.mp3";
    expect(resolveAssetForRender(url)).toBe(url);
  });

  it("returns http:// URLs unchanged", () => {
    const url = "http://example.com/audio.mp3";
    expect(resolveAssetForRender(url)).toBe(url);
  });

  it("returns https:// URLs unchanged", () => {
    const url = "https://cdn.example.com/audio.mp3";
    expect(resolveAssetForRender(url)).toBe(url);
  });

  it("throws for paths that do not start with /assets/ and are not URLs", () => {
    expect(() => resolveAssetForRender("/uploads/audio.mp3")).toThrow(
      "Unexpected asset path: /uploads/audio.mp3",
    );
  });

  it("throws for bare filenames that are not URLs", () => {
    expect(() => resolveAssetForRender("audio.mp3")).toThrow(
      "Unexpected asset path: audio.mp3",
    );
  });
});
