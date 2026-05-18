/**
 * subtitle-karaoke-word preset
 *
 * v1 simplification: use pure CSS `@keyframes` animations for both segment
 * show/hide and per-word highlight. Engine-level keyframes are empty. Future
 * iterations may move to per-element animation when the runtime supports it.
 *
 * Each segment gets a pair of @keyframes (subtitle-seg-show-N / subtitle-seg-hide-N)
 * that fade the segment in/out. Inside each segment, every word gets its own
 * @keyframes (subtitle-word-highlight-S-W) that transitions the word color from
 * the muted value (rgba(255,255,255,0.45)) to full white, with animation-delay
 * computed from word.startFrame / fps and animation-duration from the word's
 * duration in frames / fps.
 */

import type { Transcript } from "@open-effects/shared-types";
import type { SubtitlePreset, SubtitlePresetContext, SubtitlePresetOutput } from "./types";

/** HTML-escape a string so it is safe to inject as text content inside an element. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a number to at most 4 significant decimal places, stripping trailing zeros. */
function fmtSeconds(frames: number, fps: number): string {
  const secs = frames / fps;
  // Avoid "-0s" for edge cases
  return `${parseFloat(secs.toFixed(4))}s`;
}

export const karaokeWord: SubtitlePreset = {
  key: "subtitle-karaoke-word",
  name: "Karaoke per word",
  description: "Each word highlights when it is spoken; the segment fades in/out around the words.",
  iconKey: "Mic",

  generate(transcript: Transcript, ctx: SubtitlePresetContext): SubtitlePresetOutput {
    const { fps } = ctx;
    // Fade duration in frames (~8 frames ≈ 0.27s at 30fps)
    const FADE_FRAMES = 8;

    // Build HTML — one segment div per segment, one word span per word
    const segmentHtml = transcript.segments
      .map((seg, i) => {
        const wordSpans = seg.words
          .map((word, w) => {
            const prefix = w === 0 ? "" : " ";
            return `<span class="subtitle-word" data-s="${i}" data-w="${w}">${prefix}${escapeHtml(word.text)}</span>`;
          })
          .join("");
        return `  <div class="subtitle-segment" data-i="${i}">${wordSpans}</div>`;
      })
      .join("\n");
    const html = `<div class="subtitle-container">\n${segmentHtml}\n</div>`;

    // Build CSS
    const containerCss = [
      ".subtitle-container {",
      "  position: absolute;",
      "  bottom: 10%;",
      "  left: 50%;",
      "  transform: translateX(-50%);",
      "  width: 80%;",
      "  text-align: center;",
      "  color: white;",
      "  font-family: sans-serif;",
      "  font-size: 32px;",
      "  text-shadow: 0 2px 4px rgba(0,0,0,0.6);",
      "}",
      ".subtitle-segment {",
      "  opacity: 0;",
      "}",
      ".subtitle-word {",
      "  color: rgba(255,255,255,0.45);",
      "  transition: color 0.1s linear;",
      "}",
    ].join("\n");

    // Per-segment show/hide animations
    const segmentCss = transcript.segments
      .map((seg, i) => {
        const showDelay = fmtSeconds(seg.startFrame, fps);
        const fadeDuration = fmtSeconds(FADE_FRAMES, fps);
        const hideStartFrame = Math.max(seg.startFrame, seg.endFrame - FADE_FRAMES);
        const hideDelay = fmtSeconds(hideStartFrame, fps);

        return [
          `@keyframes subtitle-seg-show-${i} {`,
          "  from { opacity: 0; }",
          "  to { opacity: 1; }",
          "}",
          `@keyframes subtitle-seg-hide-${i} {`,
          "  from { opacity: 1; }",
          "  to { opacity: 0; }",
          "}",
          `.subtitle-segment[data-i="${i}"] {`,
          `  animation: subtitle-seg-show-${i} ${fadeDuration} linear ${showDelay} 1 forwards,`,
          `             subtitle-seg-hide-${i} ${fadeDuration} linear ${hideDelay} 1 forwards;`,
          "}",
        ].join("\n");
      })
      .join("\n");

    // Per-word highlight animations
    const wordCss = transcript.segments
      .map((seg, i) =>
        seg.words
          .map((word, w) => {
            const wordDelay = fmtSeconds(word.startFrame, fps);
            const wordDuration = fmtSeconds(Math.max(1, word.endFrame - word.startFrame), fps);

            return [
              `@keyframes subtitle-word-highlight-${i}-${w} {`,
              "  from { color: rgba(255,255,255,0.45); }",
              "  to { color: rgba(255,255,255,1); }",
              "}",
              `.subtitle-word[data-s="${i}"][data-w="${w}"] {`,
              `  animation: subtitle-word-highlight-${i}-${w} ${wordDuration} linear ${wordDelay} 1 forwards;`,
              "}",
            ].join("\n");
          })
          .join("\n"),
      )
      .join("\n");

    const css = `${containerCss}\n${segmentCss}\n${wordCss}`;

    // Engine-level keyframes are intentionally empty.
    // See file header comment for the v1 rationale.
    const keyframes = [];

    return { html, css, keyframes };
  },
};
