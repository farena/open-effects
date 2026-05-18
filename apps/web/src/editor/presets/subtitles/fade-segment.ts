/**
 * subtitle-fade-segment preset
 *
 * v1 simplification: use pure CSS `@keyframes` animations per segment for
 * show/hide. Engine-level keyframes are empty. Future iterations may move to
 * per-element animation when the runtime supports it.
 *
 * Each segment gets its own @keyframes pair (subtitle-show-N / subtitle-hide-N)
 * and an `animation` property on `.subtitle-segment[data-i="N"]` with delays
 * computed in seconds from segment.startFrame / fps. The layer container
 * (subtitle-container) is always visible; only individual segments fade in/out.
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

export const fadeSegment: SubtitlePreset = {
  key: "subtitle-fade-segment",
  name: "Fade per segment",
  description: "Each segment fades in at its startFrame and out at its endFrame.",
  iconKey: "Captions",

  generate(transcript: Transcript, ctx: SubtitlePresetContext): SubtitlePresetOutput {
    const { fps } = ctx;
    // Fade duration in frames (~8 frames ≈ 0.27s at 30fps)
    const FADE_FRAMES = 8;

    // Build HTML
    const segmentHtml = transcript.segments
      .map((seg, i) => `  <div class="subtitle-segment" data-i="${i}">${escapeHtml(seg.text)}</div>`)
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
    ].join("\n");

    const segmentCss = transcript.segments
      .map((seg, i) => {
        const showDelay = fmtSeconds(seg.startFrame, fps);
        const fadeDuration = fmtSeconds(FADE_FRAMES, fps);
        // Hide starts FADE_FRAMES before endFrame so the fade-out completes at endFrame
        const hideStartFrame = Math.max(seg.startFrame, seg.endFrame - FADE_FRAMES);
        const hideDelay = fmtSeconds(hideStartFrame, fps);

        return [
          `@keyframes subtitle-show-${i} {`,
          "  from { opacity: 0; }",
          "  to { opacity: 1; }",
          "}",
          `@keyframes subtitle-hide-${i} {`,
          "  from { opacity: 1; }",
          "  to { opacity: 0; }",
          "}",
          `.subtitle-segment[data-i="${i}"] {`,
          `  animation: subtitle-show-${i} ${fadeDuration} linear ${showDelay} 1 forwards,`,
          `             subtitle-hide-${i} ${fadeDuration} linear ${hideDelay} 1 forwards;`,
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
