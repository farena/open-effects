import { describe, it, expect } from "vitest";
import transcriptFixture from "../../../fixtures/transcript-3segments.json";
import { TranscriptSchema, type Transcript } from "@open-effects/shared-types";
import { slideSegment } from "../../../../src/editor/presets/subtitles/slide-segment";

const transcript: Transcript = TranscriptSchema.parse(transcriptFixture);
const ctx = { layerStartFrame: 0, fps: 30 };

describe("slideSegment preset", () => {
  it("has correct metadata", () => {
    expect(slideSegment.key).toBe("subtitle-slide-segment");
    expect(slideSegment.name).toBe("Slide per segment");
    expect(slideSegment.iconKey).toBe("ArrowUpFromLine");
  });

  it("generates HTML with exactly 3 subtitle-segment divs", () => {
    const { html } = slideSegment.generate(transcript, ctx);
    const matches = html.match(/class="subtitle-segment"/g);
    expect(matches).toHaveLength(3);
  });

  it("wraps content in subtitle-container", () => {
    const { html } = slideSegment.generate(transcript, ctx);
    expect(html).toContain('class="subtitle-container"');
  });

  it("emits data-i attributes for each segment", () => {
    const { html } = slideSegment.generate(transcript, ctx);
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
    const { html } = slideSegment.generate(dangerousTranscript, ctx);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&#39;");
  });

  it("CSS contains @keyframes for subtitle-slide-show-0, subtitle-slide-show-1, subtitle-slide-show-2", () => {
    const { css } = slideSegment.generate(transcript, ctx);
    expect(css).toContain("@keyframes subtitle-slide-show-0");
    expect(css).toContain("@keyframes subtitle-slide-show-1");
    expect(css).toContain("@keyframes subtitle-slide-show-2");
  });

  it("CSS contains @keyframes for subtitle-slide-hide-0, subtitle-slide-hide-1, subtitle-slide-hide-2", () => {
    const { css } = slideSegment.generate(transcript, ctx);
    expect(css).toContain("@keyframes subtitle-slide-hide-0");
    expect(css).toContain("@keyframes subtitle-slide-hide-1");
    expect(css).toContain("@keyframes subtitle-slide-hide-2");
  });

  it("CSS contains translateY values for slide animation", () => {
    const { css } = slideSegment.generate(transcript, ctx);
    expect(css).toContain("translateY(20px)");
    expect(css).toContain("translateY(0px)");
    expect(css).toContain("translateY(-20px)");
  });

  it("show-delay for segment 0 matches startFrame/fps (30/30 = 1s)", () => {
    const { css } = slideSegment.generate(transcript, ctx);
    // segment s0 has startFrame: 30, fps: 30 → show delay = 1s
    expect(css).toContain("1s");
  });

  it("engine keyframes array is empty (v1 CSS-only animation simplification)", () => {
    const { keyframes } = slideSegment.generate(transcript, ctx);
    expect(keyframes).toHaveLength(0);
  });

  it("CSS contains container styles", () => {
    const { css } = slideSegment.generate(transcript, ctx);
    expect(css).toContain(".subtitle-container");
    expect(css).toContain("position: absolute");
    expect(css).toContain("bottom: 10%");
  });

  it("CSS contains base subtitle-segment style with opacity: 0 and translateY(20px)", () => {
    const { css } = slideSegment.generate(transcript, ctx);
    expect(css).toContain(".subtitle-segment");
    expect(css).toContain("opacity: 0");
    expect(css).toContain("translateY(20px)");
  });

  it("CSS uses ease-out easing for animations", () => {
    const { css } = slideSegment.generate(transcript, ctx);
    expect(css).toContain("ease-out");
  });

  it("CSS uses forwards fill mode for animations", () => {
    const { css } = slideSegment.generate(transcript, ctx);
    expect(css).toContain("forwards");
  });
});
