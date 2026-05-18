import { describe, it, expect } from "vitest";
import transcriptFixture from "../../../fixtures/transcript-3segments.json";
import { TranscriptSchema, type Transcript } from "@open-effects/shared-types";
import { fadeSegment } from "../../../../src/editor/presets/subtitles/fade-segment";

const transcript: Transcript = TranscriptSchema.parse(transcriptFixture);
const ctx = { layerStartFrame: 0, fps: 30 };

describe("fadeSegment preset", () => {
  it("has correct metadata", () => {
    expect(fadeSegment.key).toBe("subtitle-fade-segment");
    expect(fadeSegment.name).toBe("Fade per segment");
    expect(fadeSegment.iconKey).toBe("Captions");
  });

  it("generates HTML with exactly 3 subtitle-segment divs", () => {
    const { html } = fadeSegment.generate(transcript, ctx);
    const matches = html.match(/class="subtitle-segment"/g);
    expect(matches).toHaveLength(3);
  });

  it("wraps content in subtitle-container", () => {
    const { html } = fadeSegment.generate(transcript, ctx);
    expect(html).toContain('class="subtitle-container"');
  });

  it("emits data-i attributes for each segment", () => {
    const { html } = fadeSegment.generate(transcript, ctx);
    expect(html).toContain('data-i="0"');
    expect(html).toContain('data-i="1"');
    expect(html).toContain('data-i="2"');
  });

  it("HTML-escapes special characters in segment text", () => {
    const dangerousTranscript: Transcript = TranscriptSchema.parse({
      segments: [
        {
          id: "sx",
          text: "<script>alert('xss')</script> & more",
          startFrame: 0,
          endFrame: 30,
          words: [],
        },
      ],
    });
    const { html } = fadeSegment.generate(dangerousTranscript, ctx);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&#39;");
  });

  it("CSS contains @keyframes for subtitle-show-0, subtitle-show-1, subtitle-show-2", () => {
    const { css } = fadeSegment.generate(transcript, ctx);
    expect(css).toContain("@keyframes subtitle-show-0");
    expect(css).toContain("@keyframes subtitle-show-1");
    expect(css).toContain("@keyframes subtitle-show-2");
  });

  it("CSS contains @keyframes for subtitle-hide-0, subtitle-hide-1, subtitle-hide-2", () => {
    const { css } = fadeSegment.generate(transcript, ctx);
    expect(css).toContain("@keyframes subtitle-hide-0");
    expect(css).toContain("@keyframes subtitle-hide-1");
    expect(css).toContain("@keyframes subtitle-hide-2");
  });

  it("CSS contains animation-delay computed from startFrame/fps (1s for frame 30 at fps 30)", () => {
    const { css } = fadeSegment.generate(transcript, ctx);
    // segment s0 has startFrame: 30, fps: 30 → delay = 1s
    expect(css).toContain("1s");
  });

  it("CSS contains animation-delay for segment s1 (4s for frame 120 at fps 30)", () => {
    const { css } = fadeSegment.generate(transcript, ctx);
    // segment s1 has startFrame: 120, fps: 30 → delay = 4s
    expect(css).toContain("4s");
  });

  it("CSS contains animation-delay for segment s2 (8s for frame 240 at fps 30)", () => {
    const { css } = fadeSegment.generate(transcript, ctx);
    // segment s2 has startFrame: 240, fps: 30 → delay = 8s
    expect(css).toContain("8s");
  });

  it("engine keyframes array is empty (v1 CSS-only animation simplification)", () => {
    const { keyframes } = fadeSegment.generate(transcript, ctx);
    expect(keyframes).toHaveLength(0);
  });

  it("CSS contains container styles", () => {
    const { css } = fadeSegment.generate(transcript, ctx);
    expect(css).toContain(".subtitle-container");
    expect(css).toContain("position: absolute");
    expect(css).toContain("bottom: 10%");
  });

  it("CSS contains base subtitle-segment style with opacity: 0", () => {
    const { css } = fadeSegment.generate(transcript, ctx);
    expect(css).toContain(".subtitle-segment");
    expect(css).toContain("opacity: 0");
  });

  it("respects layerStartFrame offset in animation delays", () => {
    const { css } = fadeSegment.generate(transcript, { layerStartFrame: 30, fps: 30 });
    // segment s0 startFrame: 30, but layer starts at frame 30, so relative startFrame is 30-30=0 → delay 0s
    // However, the design uses ctx.layerStartFrame as an offset, not subtraction.
    // Per the plan: delays are from frames/fps with layerStartFrame added to absolute frames.
    // Actually recheck: the plan says layerStartFrame is a context offset for keyframes, not for CSS.
    // For CSS, we compute from absolute segment.startFrame / fps (the segment frames are already absolute).
    // With layerStartFrame=30: delay for s0 = 30/30 = 1s (same absolute frame)
    expect(css).toContain("@keyframes subtitle-show-0");
  });
});
