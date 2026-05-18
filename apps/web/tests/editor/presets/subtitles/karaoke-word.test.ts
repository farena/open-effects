import { describe, it, expect } from "vitest";
import transcriptFixture from "../../../fixtures/transcript-3segments.json";
import { TranscriptSchema, type Transcript } from "@open-effects/shared-types";
import { karaokeWord } from "../../../../src/editor/presets/subtitles/karaoke-word";

const transcript: Transcript = TranscriptSchema.parse(transcriptFixture);
const ctx = { layerStartFrame: 0, fps: 30 };

describe("karaokeWord preset", () => {
  it("has correct metadata", () => {
    expect(karaokeWord.key).toBe("subtitle-karaoke-word");
    expect(karaokeWord.name).toBe("Karaoke per word");
    expect(karaokeWord.iconKey).toBe("Mic");
  });

  it("generates HTML with exactly 3 subtitle-segment divs", () => {
    const { html } = karaokeWord.generate(transcript, ctx);
    const matches = html.match(/class="subtitle-segment"/g);
    expect(matches).toHaveLength(3);
  });

  it("wraps content in subtitle-container", () => {
    const { html } = karaokeWord.generate(transcript, ctx);
    expect(html).toContain('class="subtitle-container"');
  });

  it("generates HTML with correct number of subtitle-word spans (15 total)", () => {
    // segment 0: 5 words, segment 1: 6 words, segment 2: 4 words = 15
    const { html } = karaokeWord.generate(transcript, ctx);
    const matches = html.match(/class="subtitle-word"/g);
    expect(matches).toHaveLength(15);
  });

  it("each subtitle-word span has data-s and data-w attributes", () => {
    const { html } = karaokeWord.generate(transcript, ctx);
    // Check a few explicit examples
    expect(html).toContain('data-s="0" data-w="0"');
    expect(html).toContain('data-s="0" data-w="4"');
    expect(html).toContain('data-s="1" data-w="0"');
    expect(html).toContain('data-s="2" data-w="3"');
  });

  it("CSS contains @keyframes subtitle-seg-show-0", () => {
    const { css } = karaokeWord.generate(transcript, ctx);
    expect(css).toContain("@keyframes subtitle-seg-show-0");
  });

  it("CSS contains @keyframes subtitle-word-highlight-0-0", () => {
    const { css } = karaokeWord.generate(transcript, ctx);
    expect(css).toContain("@keyframes subtitle-word-highlight-0-0");
  });

  it("animation delay for word 0 of segment 0 matches startFrame/fps (1s for frame 30 at 30fps)", () => {
    const { css } = karaokeWord.generate(transcript, ctx);
    // word 0 of segment 0 has startFrame: 30, fps: 30 → 1s
    // The rule for [data-s="0"][data-w="0"] uses shorthand animation with delay embedded
    // e.g. animation: subtitle-word-highlight-0-0 <dur> linear 1s 1 forwards;
    expect(css).toContain('data-s="0"][data-w="0"]');
    // Extract the block for this word and check the delay value appears after "linear"
    const idx = css.indexOf('.subtitle-word[data-s="0"][data-w="0"]');
    const block = css.slice(idx, idx + 200);
    expect(block).toMatch(/linear 1s/);
  });

  it("engine keyframes array is empty (v1 CSS-only animation simplification)", () => {
    const { keyframes } = karaokeWord.generate(transcript, ctx);
    expect(keyframes).toHaveLength(0);
  });

  it("CSS contains container styles", () => {
    const { css } = karaokeWord.generate(transcript, ctx);
    expect(css).toContain(".subtitle-container");
    expect(css).toContain("position: absolute");
    expect(css).toContain("bottom: 10%");
  });

  it("CSS contains base .subtitle-segment with opacity: 0", () => {
    const { css } = karaokeWord.generate(transcript, ctx);
    expect(css).toContain(".subtitle-segment {");
    expect(css).toContain("opacity: 0");
  });

  it("CSS contains base .subtitle-word with muted color", () => {
    const { css } = karaokeWord.generate(transcript, ctx);
    expect(css).toContain(".subtitle-word {");
    expect(css).toContain("rgba(255,255,255,0.45)");
  });

  it("HTML-escapes special characters in word text", () => {
    const dangerousTranscript: Transcript = TranscriptSchema.parse({
      segments: [
        {
          id: "sx",
          text: "<b> & test",
          startFrame: 0,
          endFrame: 30,
          words: [
            { text: "<b>", startFrame: 0, endFrame: 10 },
            { text: "&", startFrame: 12, endFrame: 20 },
            { text: "test", startFrame: 22, endFrame: 30 },
          ],
        },
      ],
    });
    const { html } = karaokeWord.generate(dangerousTranscript, ctx);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;");
  });

  it("emits data-i attributes on segments", () => {
    const { html } = karaokeWord.generate(transcript, ctx);
    expect(html).toContain('data-i="0"');
    expect(html).toContain('data-i="1"');
    expect(html).toContain('data-i="2"');
  });
});
