import { newId } from "@/lib/ids";
import type { Keyframe } from "@open-effects/shared-types";
import type { AnimationPreset, BuildContext } from "./types";

/**
 * Resolve the anchor frame for a preset based on category.
 *
 * | category | anchorFrame |
 * |----------|-------------|
 * | in       | layer.startFrame |
 * | out      | layer.endFrame - duration (min layer.startFrame) |
 * | effect   | caller-provided (anchorFrame >= 0) or midpoint |
 */
export function resolveAnchor(
  preset: AnimationPreset,
  ctx: BuildContext,
  clampedDuration: number,
): number {
  const { layer, anchorFrame } = ctx;

  switch (preset.category) {
    case "in":
      return layer.startFrame;

    case "out":
      return Math.max(layer.startFrame, layer.endFrame - clampedDuration);

    case "effect":
      // -1 is the sentinel meaning "compute midpoint"
      if (anchorFrame >= 0) {
        return anchorFrame;
      }
      return Math.floor((layer.startFrame + layer.endFrame) / 2);
  }
}

/**
 * Build the keyframes for a preset, resolving anchors and clamping duration.
 * Assigns ids to all returned keyframes via newId().
 */
export function buildPresetKeyframes(
  preset: AnimationPreset,
  ctx: BuildContext,
): Keyframe[] {
  const layerLen = ctx.layer.endFrame - ctx.layer.startFrame;
  const dur = Math.min(ctx.duration, layerLen);

  const resolvedAnchor = resolveAnchor(preset, ctx, dur);

  const rawKeyframes = preset.build({
    ...ctx,
    duration: dur,
    anchorFrame: resolvedAnchor,
  });

  return rawKeyframes.map((kf) => ({ ...kf, id: newId() }));
}
