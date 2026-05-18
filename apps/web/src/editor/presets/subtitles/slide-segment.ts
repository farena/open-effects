/**
 * subtitle-slide-segment preset
 *
 * v1 simplification: use pure CSS `@keyframes` animations per segment for
 * show/hide with vertical slide motion. Engine-level keyframes are empty.
 * Future iterations may move to per-element animation when the runtime
 * supports it.
 *
 * Each segment gets its own @keyframes pair:
 *   - subtitle-slide-show-N: slides up from translateY(20px) to translateY(0px)
 *     while fading in, starting at segment.startFrame / fps.
 *   - subtitle-slide-hide-N: slides down to translateY(-20px) while fading out,
 *     starting at (segment.endFrame - 8) / fps.
 *
 * Both animations use 8-frame duration (≈0.27s at 30fps) and ease-out easing
 * with `animation-fill-mode: forwards`.
 *
 * The layer container (subtitle-container) is always visible; only individual
 * segments animate in/out.
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

export const slideSegment: SubtitlePreset = {
  key: "subtitle-slide-segment",
  name: "Slide per segment",
  description: "Each segment slides up into place and out below.",
  iconKey: "ArrowUpFromLine",

  generate(transcript: Transcript, ctx: SubtitlePresetContext): SubtitlePresetOutput {
    const { fps } = ctx;
    // Slide/fade duration in frames (~8 frames ≈ 0.27s at 30fps)
    const SLIDE_FRAMES = 8;

    // Build HTML — same shape as fade-segment
    const segmentHtml = transcript.segments
      .map((seg, i) => `  <div class="subtitle-segment" data-i="${i}">${escapeHtml(seg.text)}</div>`)
      .join("\n");
    const html = `<div class="subtitle-container">\n${segmentHtml}\n</div>`;

    // Build CSS — container styles identical to fade-segment
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
      "  transform: translateY(20px);",
      "}",
    ].join("\n");

    const segmentCss = transcript.segments
      .map((seg, i) => {
        const showDelay = fmtSeconds(seg.startFrame, fps);
        const slideDuration = fmtSeconds(SLIDE_FRAMES, fps);
        // Hide starts SLIDE_FRAMES before endFrame so the slide-out completes at endFrame
        const hideStartFrame = Math.max(seg.startFrame, seg.endFrame - SLIDE_FRAMES);
        const hideDelay = fmtSeconds(hideStartFrame, fps);

        return [
          `@keyframes subtitle-slide-show-${i} {`,
          "  from { opacity: 0; transform: translateY(20px); }",
          "  to { opacity: 1; transform: translateY(0px); }",
          "}",
          `@keyframes subtitle-slide-hide-${i} {`,
          "  from { opacity: 1; transform: translateY(0px); }",
          "  to { opacity: 0; transform: translateY(-20px); }",
          "}",
          `.subtitle-segment[data-i="${i}"] {`,
          `  animation: subtitle-slide-show-${i} ${slideDuration} ease-out ${showDelay} 1 forwards,`,
          `             subtitle-slide-hide-${i} ${slideDuration} ease-out ${hideDelay} 1 forwards;`,
          "}",
        ].join("\n");
      })
      .join("\n");

    const css = `${containerCss}\n${segmentCss}`;

    // Engine-level keyframes are intentionally empty.
    // See file header comment for the v1 rationale.
    const keyframes = [];

    return { html, css, keyframes };
  },
};
