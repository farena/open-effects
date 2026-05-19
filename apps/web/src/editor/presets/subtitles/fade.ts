/**
 * subtitle-fade preset
 *
 * Animations are driven by the Remotion frame (via the `--re-time` CSS variable
 * injected by the Layer runtime), not by the browser wall clock. We declare
 * standard `@keyframes` animations and then:
 *   - pin them with `animation-play-state: paused`
 *   - override `animation-delay` to `calc(<originalDelay> - var(--re-time))`
 * That way each frame Remotion samples, the paused animation is positioned at
 * `re-time - originalDelay` seconds into its duration, so play/pause/seek all
 * stay in lockstep with the rest of the timeline.
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

export const fade: SubtitlePreset = {
  key: "subtitle-fade",
  name: "Fade",
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
