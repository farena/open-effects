import { describe, it, expect } from "vitest";
import transcriptFixture from "../../../fixtures/transcript-3segments.json";
import { TranscriptSchema, type Transcript } from "@open-effects/shared-types";
import { fade } from "../../../../src/editor/presets/subtitles/fade";

const transcript: Transcript = TranscriptSchema.parse(transcriptFixture);
const ctx = { layerStartFrame: 0, fps: 30 };

describe("fade preset", () => {
  it("has correct metadata", () => {
    expect(fade.key).toBe("subtitle-fade");
    expect(fade.name).toBe("Fade");
    expect(fade.iconKey).toBe("Captions");
  });

  it("generates HTML with exactly 3 subtitle-segment divs", () => {
    const { html } = fade.generate(transcript, ctx);
    const matches = html.match(/class="subtitle-segment"/g);
    expect(matches).toHaveLength(3);
  });

  it("wraps content in subtitle-container", () => {
    const { html } = fade.generate(transcript, ctx);
    expect(html).toContain('class="subtitle-container"');
  });

  it("emits data-i attributes for each segment", () => {
    const { html } = fade.generate(transcript, ctx);
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
        },
      ],
    });
    const { html } = fade.generate(dangerousTranscript, ctx);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&#39;");
  });

  it("CSS contains @keyframes for subtitle-show-0, subtitle-show-1, subtitle-show-2", () => {
    const { css } = fade.generate(transcript, ctx);
    expect(css).toContain("@keyframes subtitle-show-0");
    expect(css).toContain("@keyframes subtitle-show-1");
    expect(css).toContain("@keyframes subtitle-show-2");
  });

  it("CSS contains @keyframes for subtitle-hide-0, subtitle-hide-1, subtitle-hide-2", () => {
    const { css } = fade.generate(transcript, ctx);
    expect(css).toContain("@keyframes subtitle-hide-0");
    expect(css).toContain("@keyframes subtitle-hide-1");
    expect(css).toContain("@keyframes subtitle-hide-2");
  });

  it("CSS contains animation-delay computed from startFrame/fps (1s for frame 30 at fps 30)", () => {
    const { css } = fade.generate(transcript, ctx);
    expect(css).toContain("1s");
  });

  it("CSS contains animation-delay for segment s1 (4s for frame 120 at fps 30)", () => {
    const { css } = fade.generate(transcript, ctx);
    expect(css).toContain("4s");
  });

  it("CSS contains animation-delay for segment s2 (8s for frame 240 at fps 30)", () => {
    const { css } = fade.generate(transcript, ctx);
    expect(css).toContain("8s");
  });

  it("engine keyframes array is empty (v1 CSS-only animation simplification)", () => {
    const { keyframes } = fade.generate(transcript, ctx);
    expect(keyframes).toHaveLength(0);
  });

  it("CSS contains container styles", () => {
    const { css } = fade.generate(transcript, ctx);
    expect(css).toContain(".subtitle-container");
    expect(css).toContain("position: absolute");
    expect(css).toContain("bottom: 10%");
  });

  it("CSS contains base subtitle-segment style with opacity: 0", () => {
    const { css } = fade.generate(transcript, ctx);
    expect(css).toContain(".subtitle-segment");
    expect(css).toContain("opacity: 0");
  });

  it("uses black text and no drop shadow by default", () => {
    const { css } = fade.generate(transcript, ctx);
    expect(css).toContain("color: black");
    expect(css).not.toContain("text-shadow");
  });

  it("container is a centered grid that stacks all segments in the same cell", () => {
    const { css } = fade.generate(transcript, ctx);
    expect(css).toContain("display: grid");
    expect(css).toContain("place-items: center");
    expect(css).toContain("grid-area: 1 / 1");
  });

  it("pauses CSS animations and binds animation-delay to --re-time so they follow Remotion frames", () => {
    const { css } = fade.generate(transcript, ctx);
    expect(css).toContain("animation-play-state: paused");
    expect(css).toContain("calc(1s - var(--re-time, 0s))");
  });
});
