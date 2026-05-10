import type { Layer } from "@open-effects/shared-types";
import type { AnimationPreset, BuildContext, PresetConflict } from "./types";
import { resolveAnchor } from "./build-keyframes";

/**
 * Detect conflicts between the target preset range and existing keyframes
 * on the given layer.
 *
 * Returns one PresetConflict per property (only for properties listed in
 * `preset.animatedProperties`) that has at least one existing keyframe in
 * [anchor, anchor+duration].
 */
export function detectPresetConflicts(
  layer: Layer,
  preset: AnimationPreset,
  ctx: BuildContext,
): PresetConflict[] {
  const layerLen = ctx.layer.endFrame - ctx.layer.startFrame;
  const dur = Math.min(ctx.duration, layerLen);
  const anchor = resolveAnchor(preset, ctx, dur);

  const rangeStart = anchor;
  const rangeEnd = anchor + dur;

  // Filter to keyframes that:
  //   1. are on a property this preset animates
  //   2. fall within [anchor, anchor+duration] inclusive
  const relevant = layer.keyframes.filter(
    (kf) =>
      preset.animatedProperties.includes(kf.property) &&
      kf.frame >= rangeStart &&
      kf.frame <= rangeEnd,
  );

  // Group by property
  const byProperty = new Map<string, number[]>();
  for (const kf of relevant) {
    const frames = byProperty.get(kf.property) ?? [];
    frames.push(kf.frame);
    byProperty.set(kf.property, frames);
  }

  // Build sorted conflicts
  const conflicts: PresetConflict[] = [];
  for (const [property, frames] of byProperty.entries()) {
    conflicts.push({
      property,
      existingFrames: [...frames].sort((a, b) => a - b),
    });
  }

  return conflicts;
}
