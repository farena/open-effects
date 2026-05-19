/**
 * subtitle-pop-up preset
 *
 * One segment at a time, centered in the container. Each segment pops in
 * (scale 0 → 1.15 → 1, opacity 0 → 1) at its startFrame and pops out
 * (scale 1 → 0) just before its endFrame, so the previous segment finishes
 * vanishing before the next one starts appearing.
 *
 * Like the other presets, animations are paused (`animation-play-state:
 * paused`) and their `animation-delay` is rewritten to
 * `calc(<originalDelay> - var(--re-time, 0s))`, keeping the visual state in
 * lockstep with Remotion play/pause/seek instead of the browser wall clock.
 *
 * For a per-word effect, split the transcript into smaller segments — every
 * preset is segment-level, so finer granularity = more pops.
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
  return `${parseFloat(secs.toFixed(4))}s`;
}

export const popUp: SubtitlePreset = {
  key: "subtitle-pop-up",
  name: "Pop up",
  description:
    "Each segment pops in centered, then pops out before the next segment appears.",
  iconKey: "Sparkle",

  generate(transcript: Transcript, ctx: SubtitlePresetContext): SubtitlePresetOutput {
    const { fps } = ctx;
    // Short pop durations so consecutive segments can complete their entry
    // and exit without overlapping when the transcript is dense.
    const POP_IN_FRAMES = 6;
    const POP_OUT_FRAMES = 6;

    // HTML: one .subtitle-segment per segment.
    const segmentHtml = transcript.segments
      .map(
        (seg, i) =>
          `  <div class="subtitle-segment" data-i="${i}">${escapeHtml(seg.text)}</div>`,
      )
      .join("\n");
    const html = `<div class="subtitle-container">\n${segmentHtml}\n</div>`;

    // Container reserves vertical space (min-height) so that `top: 50%` on
    // absolutely-positioned segments has a real center to anchor to. Without
    // it the container would collapse to height 0 (no children participate in
    // flow) and every segment would render glued to the bottom: 10% line.
    const containerCss = [
      ".subtitle-container {",
      "  position: absolute;",
      "  bottom: 10%;",
      "  left: 50%;",
      "  transform: translateX(-50%);",
      "  width: 80%;",
      "  min-height: 2em;",
      "  display: grid;",
      "  place-items: center;",
      "  color: black;",
      "  font-family: sans-serif;",
      "  font-size: 32px;",
      "}",
      // Each segment is absolutely positioned at the (absolute) container's
      // center via translate(-50%, -50%). The base state is scale(0)+opacity(0)
      // so segments are invisible until their pop-in.
      ".subtitle-segment {",
      "  position: absolute;",
      "  top: 50%;",
      "  left: 50%;",
      "  transform: translate(-50%, -50%) scale(0);",
      "  opacity: 0;",
      "  text-align: center;",
      "  transform-origin: center center;",
      "}",
    ].join("\n");

    // Per-segment pop-in + pop-out. The translate(-50%, -50%) is baked into
    // every keyframe so the segment stays centered while it scales.
    const segmentCss = transcript.segments
      .map((seg, i) => {
        const popInStartFrame = seg.startFrame;
        const popInEndFrame = popInStartFrame + POP_IN_FRAMES;
        // Pop-out lines up so its END equals segment.endFrame — that way the
        // segment finishes vanishing exactly at endFrame. The Math.max guard
        // keeps pop-in fully ahead of pop-out for very short segments,
        // avoiding two animations clobbering each other on `transform`.
        const popOutStartFrame = Math.max(
          popInEndFrame,
          seg.endFrame - POP_OUT_FRAMES,
        );

        const popInDelay = fmtSeconds(popInStartFrame, fps);
        const popOutDelay = fmtSeconds(popOutStartFrame, fps);
        const popInDuration = fmtSeconds(POP_IN_FRAMES, fps);
        const popOutDuration = fmtSeconds(POP_OUT_FRAMES, fps);

        return [
          `@keyframes subtitle-pop-in-${i} {`,
          "  0% { opacity: 0; transform: translate(-50%, -50%) scale(0); }",
          "  60% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }",
          "  100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }",
          "}",
          `@keyframes subtitle-pop-out-${i} {`,
          "  from { opacity: 1; transform: translate(-50%, -50%) scale(1); }",
          "  to { opacity: 0; transform: translate(-50%, -50%) scale(0); }",
          "}",
          `.subtitle-segment[data-i="${i}"] {`,
          `  animation: subtitle-pop-in-${i} ${popInDuration} ease-out ${popInDelay} 1 forwards,`,
          `             subtitle-pop-out-${i} ${popOutDuration} ease-in ${popOutDelay} 1 forwards;`,
          "  animation-play-state: paused;",
          `  animation-delay: calc(${popInDelay} - var(--re-time, 0s)),`,
          `                   calc(${popOutDelay} - var(--re-time, 0s));`,
          "}",
        ].join("\n");
      })
      .join("\n");

    const css = `${containerCss}\n${segmentCss}`;

    // Engine-level keyframes intentionally empty — all animation lives in CSS.
    const keyframes: Keyframe[] = [];

    return { html, css, keyframes };
  },
};
