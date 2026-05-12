import type { Keyframe, PresetDefinition } from "@open-effects/shared-types";
import type { AnimationPreset, BuildContext } from "./types";
import { evaluateTemplate } from "@/lib/presets/expr";

/**
 * Convert a declarative PresetDefinition into a runtime AnimationPreset.
 *
 * The returned preset's `build(ctx)` walks every track and emits a keyframe per
 * stop: the frame is `round(anchorFrame + fraction * duration)`, the value is
 * the template evaluated against `ctx.values`, and easingOut is `ctx.easing`.
 */
export function animationPresetFromDefinition(
  def: PresetDefinition,
): AnimationPreset {
  return {
    key: def.key,
    name: def.name,
    category: def.category,
    iconKey: def.iconKey,
    defaultDuration: def.defaultDuration,
    defaultEasing: def.defaultEasing,
    params: def.params,
    animatedProperties: def.animatedProperties,
    build: (ctx: BuildContext): Keyframe[] => {
      const out: Keyframe[] = [];
      for (const track of def.tracks) {
        for (const stop of track.stops) {
          out.push({
            frame: Math.round(ctx.anchorFrame + stop.fraction * ctx.duration),
            property: track.property,
            value: evaluateTemplate(stop.value, ctx.values),
            easingOut: ctx.easing,
          });
        }
      }
      return out;
    },
  };
}
