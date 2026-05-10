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

  // ── Slide In Left ──────────────────────────────────────────────────────────
  {
    key: "slide-in-left",
    name: "Slide In Left",
    category: "in",
    iconKey: "arrow-right",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [
      { kind: "number", key: "fromX", label: "From X", default: -300, unit: "px" },
    ],
    animatedProperties: ["transform.translateX"],
    build: (ctx) =>
      pairKeyframes("transform.translateX", `${ctx.values.fromX ?? -300}px`, "0px", ctx),
  },

  // ── Slide In Right ─────────────────────────────────────────────────────────
  {
    key: "slide-in-right",
    name: "Slide In Right",
    category: "in",
    iconKey: "arrow-left",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [
      { kind: "number", key: "fromX", label: "From X", default: 300, unit: "px" },
    ],
    animatedProperties: ["transform.translateX"],
    build: (ctx) =>
      pairKeyframes("transform.translateX", `${ctx.values.fromX ?? 300}px`, "0px", ctx),
  },

  // ── Scale In ───────────────────────────────────────────────────────────────
  {
    key: "scale-in",
    name: "Scale In",
    category: "in",
    iconKey: "maximize",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [
      { kind: "number", key: "fromScale", label: "From Scale", default: 0.8 },
      { kind: "number", key: "toScale",   label: "To Scale",   default: 1 },
    ],
    animatedProperties: ["transform.scale"],
    build: (ctx) =>
      pairKeyframes("transform.scale", String(ctx.values.fromScale ?? 0.8), String(ctx.values.toScale ?? 1), ctx),
  },

  // ── Pop In ─────────────────────────────────────────────────────────────────
  {
    key: "pop-in",
    name: "Pop In",
    category: "in",
    iconKey: "star",
    defaultDuration: 20,
    defaultEasing: { type: "ease-out" },
    params: [
      { kind: "number", key: "fromScale", label: "From Scale", default: 0.6 },
    ],
    animatedProperties: ["transform.scale", "opacity"],
    build: (ctx) => [
      ...pairKeyframes("transform.scale", String(ctx.values.fromScale ?? 0.6), "1", ctx),
      ...pairKeyframes("opacity", "0", "1", ctx),
    ],
  },

  // ── Fade Out ───────────────────────────────────────────────────────────────
  {
    key: "fade-out",
    name: "Fade Out",
    category: "out",
    iconKey: "eye-off",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in" },
    params: [
      { kind: "number", key: "fromOpacity", label: "From", default: 1, min: 0, max: 1 },
      { kind: "number", key: "toOpacity",   label: "To",   default: 0, min: 0, max: 1 },
    ],
    animatedProperties: ["opacity"],
    build: (ctx) =>
      pairKeyframes("opacity", String(ctx.values.fromOpacity ?? 1), String(ctx.values.toOpacity ?? 0), ctx),
  },

  // ── Slide Out Left ─────────────────────────────────────────────────────────
  {
    key: "slide-out-left",
    name: "Slide Out Left",
    category: "out",
    iconKey: "arrow-left",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in" },
    params: [
      { kind: "number", key: "toX", label: "To X", default: -300, unit: "px" },
    ],
    animatedProperties: ["transform.translateX"],
    build: (ctx) =>
      pairKeyframes("transform.translateX", "0px", `${ctx.values.toX ?? -300}px`, ctx),
  },

  // ── Slide Out Right ────────────────────────────────────────────────────────
  {
    key: "slide-out-right",
    name: "Slide Out Right",
    category: "out",
    iconKey: "arrow-right",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in" },
    params: [
      { kind: "number", key: "toX", label: "To X", default: 300, unit: "px" },
    ],
    animatedProperties: ["transform.translateX"],
    build: (ctx) =>
      pairKeyframes("transform.translateX", "0px", `${ctx.values.toX ?? 300}px`, ctx),
  },

  // ── Scale Out ──────────────────────────────────────────────────────────────
  {
    key: "scale-out",
    name: "Scale Out",
    category: "out",
    iconKey: "minimize",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in" },
    params: [
      { kind: "number", key: "fromScale", label: "From Scale", default: 1 },
      { kind: "number", key: "toScale",   label: "To Scale",   default: 0.8 },
    ],
    animatedProperties: ["transform.scale"],
    build: (ctx) =>
      pairKeyframes("transform.scale", String(ctx.values.fromScale ?? 1), String(ctx.values.toScale ?? 0.8), ctx),
  },

  // ── Pulse ──────────────────────────────────────────────────────────────────
  {
    key: "pulse",
    name: "Pulse",
    category: "effect",
    iconKey: "activity",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in-out" },
    params: [
      { kind: "number", key: "peakScale", label: "Peak Scale", default: 1.1 },
    ],
    animatedProperties: ["transform.scale"],
    build: (ctx) =>
      fractionalKeyframes(
        "transform.scale",
        [0, 0.5, 1],
        ["1", String(ctx.values.peakScale ?? 1.1), "1"],
        ctx,
      ),
  },

  // ── Shake ──────────────────────────────────────────────────────────────────
  {
    key: "shake",
    name: "Shake",
    category: "effect",
    iconKey: "zap",
    defaultDuration: 20,
    defaultEasing: { type: "ease-in-out" },
    params: [
      { kind: "number", key: "amplitude", label: "Amplitude", default: 8, unit: "px" },
    ],
    animatedProperties: ["transform.translateX"],
    build: (ctx) => {
      const amp = Number(ctx.values.amplitude ?? 8);
      return fractionalKeyframes(
        "transform.translateX",
        [0, 0.25, 0.5, 0.75, 1],
        ["0px", `${amp}px`, `-${amp}px`, `${amp}px`, "0px"],
        ctx,
      );
    },
  },

  // ── Wiggle ─────────────────────────────────────────────────────────────────
  {
    key: "wiggle",
    name: "Wiggle",
    category: "effect",
    iconKey: "refresh-cw",
    defaultDuration: 20,
    defaultEasing: { type: "ease-in-out" },
    params: [
      { kind: "number", key: "amplitude", label: "Amplitude", default: 5, unit: "deg" },
    ],
    animatedProperties: ["transform.rotate"],
    build: (ctx) => {
      const amp = Number(ctx.values.amplitude ?? 5);
      return fractionalKeyframes(
        "transform.rotate",
        [0, 0.25, 0.5, 0.75, 1],
        ["0deg", `${amp}deg`, `-${amp}deg`, `${amp}deg`, "0deg"],
        ctx,
      );
    },
  },
] as const;
