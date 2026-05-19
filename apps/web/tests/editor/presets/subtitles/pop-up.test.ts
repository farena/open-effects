import { describe, it, expect } from "vitest";
import transcriptFixture from "../../../fixtures/transcript-3segments.json";
import { TranscriptSchema, type Transcript } from "@open-effects/shared-types";
import { popUp } from "../../../../src/editor/presets/subtitles/pop-up";

const transcript: Transcript = TranscriptSchema.parse(transcriptFixture);
const ctx = { layerStartFrame: 0, fps: 30 };

describe("popUp preset", () => {
  it("has correct metadata", () => {
    expect(popUp.key).toBe("subtitle-pop-up");
    expect(popUp.name).toBe("Pop up");
    expect(popUp.iconKey).toBe("Sparkle");
  });

  it("generates HTML with exactly 3 subtitle-segment divs", () => {
    const { html } = popUp.generate(transcript, ctx);
    const matches = html.match(/class="subtitle-segment"/g);
    expect(matches).toHaveLength(3);
  });

  it("wraps content in subtitle-container", () => {
    const { html } = popUp.generate(transcript, ctx);
    expect(html).toContain('class="subtitle-container"');
  });

  it("emits data-i attributes for each segment", () => {
    const { html } = popUp.generate(transcript, ctx);
    expect(html).toContain('data-i="0"');
    expect(html).toContain('data-i="1"');
    expect(html).toContain('data-i="2"');
  });

  it("emits pop-in AND pop-out keyframes for every segment", () => {
    const { css } = popUp.generate(transcript, ctx);
    expect(css).toContain("@keyframes subtitle-pop-in-0");
    expect(css).toContain("@keyframes subtitle-pop-out-0");
    expect(css).toContain("@keyframes subtitle-pop-in-1");
    expect(css).toContain("@keyframes subtitle-pop-out-1");
    expect(css).toContain("@keyframes subtitle-pop-in-2");
    expect(css).toContain("@keyframes subtitle-pop-out-2");
  });

  it("pop-in keyframes overshoot to scale(1.15) before settling at scale(1)", () => {
    const { css } = popUp.generate(transcript, ctx);
    expect(css).toContain("scale(1.15)");
  });

  it("every keyframe preserves translate(-50%, -50%) so the segment stays anchored while it scales", () => {
    const { css } = popUp.generate(transcript, ctx);
    expect(css).toContain("translate(-50%, -50%) scale(0)");
    expect(css).toContain("translate(-50%, -50%) scale(1.15)");
    expect(css).toContain("translate(-50%, -50%) scale(1)");
  });

  it("positions every segment absolutely at the container's center", () => {
    const { css } = popUp.generate(transcript, ctx);
    const idx = css.indexOf(".subtitle-segment {");
    expect(idx).toBeGreaterThanOrEqual(0);
    const block = css.slice(idx, idx + 400);
    expect(block).toContain("position: absolute");
    expect(block).toContain("top: 50%");
    expect(block).toContain("left: 50%");
    expect(block).toContain("translate(-50%, -50%)");
  });

  it("schedules pop-out so each segment finishes vanishing exactly at its endFrame", () => {
    const { css } = popUp.generate(transcript, ctx);
    // Fixture seg 0: startFrame=30, endFrame=90, fps=30 → pop-out at frame 84 = 2.8s
    const idx = css.indexOf('.subtitle-segment[data-i="0"]');
    expect(idx).toBeGreaterThanOrEqual(0);
    const block = css.slice(idx, idx + 500);
    expect(block).toMatch(/ease-out 1s/); // pop-in at startFrame
    expect(block).toMatch(/ease-in 2\.8s/); // pop-out near endFrame
  });

  it("guarantees pop-in completes before pop-out begins (no transform conflicts on short segments)", () => {
    // Segment shorter than POP_IN_FRAMES + POP_OUT_FRAMES → the floor keeps
    // pop-in ahead of pop-out so the two animations don't clobber each other.
    const tight: Transcript = TranscriptSchema.parse({
      segments: [
        {
          id: "sx",
          text: "hi",
          startFrame: 30,
          endFrame: 33,
        },
      ],
    });
    const { css } = popUp.generate(tight, ctx);
    const idx = css.indexOf('.subtitle-segment[data-i="0"]');
    const block = css.slice(idx, idx + 500);
    // pop-in starts 1s, runs 6 frames → ends at frame 36 (1.2s). Naive
    // popOut = endFrame - 6 = 27 frames = 0.9s; floor pushes it to 1.2s.
    expect(block).toMatch(/ease-in 1\.2s/);
  });

  it("engine keyframes array is empty (v1 CSS-only animation simplification)", () => {
    const { keyframes } = popUp.generate(transcript, ctx);
    expect(keyframes).toHaveLength(0);
  });

  it("CSS contains container styles with min-height so absolute segments have a real center to anchor to", () => {
    const { css } = popUp.generate(transcript, ctx);
    expect(css).toContain(".subtitle-container");
    expect(css).toContain("position: absolute");
    expect(css).toContain("bottom: 10%");
    expect(css).toContain("min-height");
  });

  it("uses black text and no drop shadow by default", () => {
    const { css } = popUp.generate(transcript, ctx);
    expect(css).toContain("color: black");
    expect(css).not.toContain("text-shadow");
  });

  it("HTML-escapes special characters in segment text", () => {
    const dangerousTranscript: Transcript = TranscriptSchema.parse({
      segments: [
        {
          id: "sx",
          text: "<b> & test",
          startFrame: 0,
          endFrame: 30,
        },
      ],
    });
    const { html } = popUp.generate(dangerousTranscript, ctx);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;");
  });

  it("pauses CSS animations and binds both pop-in AND pop-out delays to --re-time", () => {
    const { css } = popUp.generate(transcript, ctx);
    expect(css).toContain("animation-play-state: paused");
    const idx = css.indexOf('.subtitle-segment[data-i="0"]');
    const block = css.slice(idx, idx + 600);
    expect(block).toContain("calc(1s - var(--re-time, 0s))");
    expect(block).toContain("calc(2.8s - var(--re-time, 0s))");
  });
});
