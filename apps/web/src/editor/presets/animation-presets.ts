// A subset of presets in this catalog is inspired by animista.net (entrances/exits/attention-seekers).
import type { AnimationPreset, BuildContext } from "./types";
import type { Keyframe } from "@open-effects/shared-types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a pair of keyframes for a single property at anchorFrame and anchorFrame+duration. */
function pairKeyframes(
  property: string,
  fromValue: string,
  toValue: string,
  ctx: BuildContext,
): Keyframe[] {
  return [
    { frame: ctx.anchorFrame, property, value: fromValue, easingOut: ctx.easing },
    { frame: ctx.anchorFrame + ctx.duration, property, value: toValue, easingOut: ctx.easing },
  ];
}

/**
 * Build keyframes for a property at a series of frames expressed as fractions
 * of [anchorFrame, anchorFrame+duration].
 */
function fractionalKeyframes(
  property: string,
  fractions: number[],
  values: string[],
  ctx: BuildContext,
): Keyframe[] {
  return fractions.map((frac, i) => ({
    frame: Math.round(ctx.anchorFrame + frac * ctx.duration),
    property,
    value: values[i],
    easingOut: ctx.easing,
  }));
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const ANIMATION_PRESETS: readonly AnimationPreset[] = [
  // ── Fade In ────────────────────────────────────────────────────────────────
  {
    key: "fade-in",
    name: "Fade In",
    category: "in",
    iconKey: "fade",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [
      { kind: "number", key: "fromOpacity", label: "From", default: 0, min: 0, max: 1 },
      { kind: "number", key: "toOpacity",   label: "To",   default: 1, min: 0, max: 1 },
    ],
    animatedProperties: ["opacity"],
    build: (ctx) =>
      pairKeyframes("opacity", String(ctx.values.fromOpacity ?? 0), String(ctx.values.toOpacity ?? 1), ctx),
  },
] as const;
