import { describe, it, expect } from "vitest";
import { LayerSchema, HtmlLayerSchema, SubtitleLayerSchema } from "@/schemas/layer";

const baseLayer = {
  id: "L1",
  order: 0,
  name: "Title",
  html: "<div>hello</div>",
  css: "",
  startFrame: 0,
  endFrame: 30,
  keyframes: [],
};

const validSubtitle = {
  linkedAudioTrackId: "track-1",
  transcript: {
    segments: [
      {
        id: "seg-1",
        text: "Hello world",
        startFrame: 0,
        endFrame: 30,
      },
    ],
  },
  presetKey: "subtitle-fade",
  manualOverride: false,
};

describe("LayerSchema (discriminated union)", () => {
  it("(a) legacy layer without type field coerces to html", () => {
    const result = LayerSchema.safeParse(baseLayer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("html");
    }
  });

  it("(b) explicit type: html parses correctly", () => {
    const result = LayerSchema.safeParse({ ...baseLayer, type: "html" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("html");
    }
  });

  it("(c) type: subtitle with valid subtitle block parses and round-trips", () => {
    const input = {
      ...baseLayer,
      type: "subtitle",
      subtitle: validSubtitle,
    };
    const first = LayerSchema.safeParse(input);
    expect(first.success).toBe(true);
    if (first.success) {
      expect(first.data.type).toBe("subtitle");
      // round-trip
      const second = LayerSchema.safeParse(first.data);
      expect(second.success).toBe(true);
      if (second.success) {
        expect(second.data.type).toBe("subtitle");
        expect(second.data).toEqual(first.data);
      }
    }
  });

  it("(d) type: subtitle without subtitle block fails", () => {
    const result = LayerSchema.safeParse({ ...baseLayer, type: "subtitle" });
    expect(result.success).toBe(false);
  });

  it("(e) endFrame < startFrame fails for html variant", () => {
    const result = LayerSchema.safeParse({
      ...baseLayer,
      type: "html",
      startFrame: 30,
      endFrame: 5,
    });
    expect(result.success).toBe(false);
  });

  it("(e) endFrame < startFrame fails for subtitle variant", () => {
    const result = LayerSchema.safeParse({
      ...baseLayer,
      type: "subtitle",
      startFrame: 30,
      endFrame: 5,
      subtitle: validSubtitle,
    });
    expect(result.success).toBe(false);
  });
});

describe("HtmlLayerSchema", () => {
  it("accepts a valid html layer", () => {
    const result = HtmlLayerSchema.safeParse(baseLayer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("html");
    }
  });
});

describe("SubtitleLayerSchema", () => {
  it("accepts a valid subtitle layer", () => {
    const result = SubtitleLayerSchema.safeParse({
      ...baseLayer,
      type: "subtitle",
      subtitle: validSubtitle,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("subtitle");
      expect(result.data.subtitle.linkedAudioTrackId).toBe("track-1");
    }
  });

  it("manualOverride defaults to false when not provided", () => {
    const result = SubtitleLayerSchema.safeParse({
      ...baseLayer,
      type: "subtitle",
      subtitle: {
        linkedAudioTrackId: "track-1",
        transcript: { segments: [] },
        presetKey: "subtitle-fade",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subtitle.manualOverride).toBe(false);
    }
  });
});
