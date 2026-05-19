/**
 * subtitle-slide preset
 *
 * Animations are driven by the Remotion frame (via the `--re-time` CSS variable
 * injected by the Layer runtime). Each segment gets its own @keyframes pair:
 *   - subtitle-slide-show-N: slides up from translateY(20px) to translateY(0px)
 *     while fading in, at segment.startFrame / fps.
 *   - subtitle-slide-hide-N: slides down to translateY(-20px) while fading out,
 *     at (segment.endFrame - 8) / fps.
 *
 * Both animations are paused (`animation-play-state: paused`) and their
 * `animation-delay` is rewritten to `calc(<originalDelay> - var(--re-time))`
 * so they stay in lockstep with play/pause/seek instead of running on the
 * browser wall clock. Duration is 8 frames (≈0.27s at 30fps), easing is
 * ease-out, fill mode is forwards.
 *
 * The layer container (subtitle-container) is always visible; only individual
 * segments animate in/out.
 */

import type { Keyframe, Transcript } from "@open-effects/shared-types";
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

export const slide: SubtitlePreset = {
  key: "subtitle-slide",
  name: "Slide",
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
      "  display: grid;",
      "  place-items: center;",
      "  color: black;",
      "  font-family: sans-serif;",
      "  font-size: 32px;",
      "}",
      ".subtitle-segment {",
      "  grid-area: 1 / 1;",
      "  text-align: center;",
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
          "  animation-play-state: paused;",
          `  animation-delay: calc(${showDelay} - var(--re-time, 0s)),`,
          `                   calc(${hideDelay} - var(--re-time, 0s));`,
          "}",
        ].join("\n");
      })
      .join("\n");

    const css = `${containerCss}\n${segmentCss}`;

    // Engine-level keyframes are intentionally empty.
    // See file header comment for the v1 rationale.
    const keyframes: Keyframe[] = [];

    return { html, css, keyframes };
  },
};
