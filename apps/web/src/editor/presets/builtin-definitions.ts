/**
 * Built-in animation presets expressed as declarative PresetDefinitions.
 *
 * This list is the source of truth for seeding the AnimationPreset table.
 * Once seeded, presets are loaded from the database via /api/presets.
 *
 * A subset is inspired by animista.net (entrances/exits/attention-seekers).
 */
import type { PresetDefinition } from "@open-effects/shared-types";

const SPRING_EASING = {
  type: "spring" as const,
  params: { damping: 8, stiffness: 100, mass: 1 },
};

export const BUILTIN_PRESET_DEFINITIONS: readonly PresetDefinition[] = [
  // ── IN ────────────────────────────────────────────────────────────────────
  {
    key: "fade-in",
    name: "Fade In",
    category: "in",
    iconKey: "fade",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [
      { kind: "number", key: "fromOpacity", label: "From", default: 0, min: 0, max: 1 },
      { kind: "number", key: "toOpacity", label: "To", default: 1, min: 0, max: 1 },
    ],
    animatedProperties: ["opacity"],
    tracks: [
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "${fromOpacity}" },
          { fraction: 1, value: "${toOpacity}" },
        ],
      },
    ],
  },
  {
    key: "slide-in-left",
    name: "Slide In Left",
    category: "in",
    iconKey: "arrow-right",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [{ kind: "number", key: "fromX", label: "From X", default: -300, unit: "px" }],
    animatedProperties: ["transform.translateX"],
    tracks: [
      {
        property: "transform.translateX",
        stops: [
          { fraction: 0, value: "${fromX}px" },
          { fraction: 1, value: "0px" },
        ],
      },
    ],
  },
  {
    key: "slide-in-right",
    name: "Slide In Right",
    category: "in",
    iconKey: "arrow-left",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [{ kind: "number", key: "fromX", label: "From X", default: 300, unit: "px" }],
    animatedProperties: ["transform.translateX"],
    tracks: [
      {
        property: "transform.translateX",
        stops: [
          { fraction: 0, value: "${fromX}px" },
          { fraction: 1, value: "0px" },
        ],
      },
    ],
  },
  {
    key: "scale-in",
    name: "Scale In",
    category: "in",
    iconKey: "maximize",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [
      { kind: "number", key: "fromScale", label: "From Scale", default: 0.8 },
      { kind: "number", key: "toScale", label: "To Scale", default: 1 },
    ],
    animatedProperties: ["transform.scale"],
    tracks: [
      {
        property: "transform.scale",
        stops: [
          { fraction: 0, value: "${fromScale}" },
          { fraction: 1, value: "${toScale}" },
        ],
      },
    ],
  },
  {
    key: "pop-in",
    name: "Pop In",
    category: "in",
    iconKey: "star",
    defaultDuration: 20,
    defaultEasing: { type: "ease-out" },
    params: [{ kind: "number", key: "fromScale", label: "From Scale", default: 0.6 }],
    animatedProperties: ["transform.scale", "opacity"],
    tracks: [
      {
        property: "transform.scale",
        stops: [
          { fraction: 0, value: "${fromScale}" },
          { fraction: 1, value: "1" },
        ],
      },
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "0" },
          { fraction: 1, value: "1" },
        ],
      },
    ],
  },
  {
    key: "slide-in-up",
    name: "Slide In Up",
    category: "in",
    iconKey: "arrow-down",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [{ kind: "number", key: "fromY", label: "From Y", default: -200, unit: "px" }],
    animatedProperties: ["transform.translateY"],
    tracks: [
      {
        property: "transform.translateY",
        stops: [
          { fraction: 0, value: "${fromY}px" },
          { fraction: 1, value: "0px" },
        ],
      },
    ],
  },
  {
    key: "slide-in-down",
    name: "Slide In Down",
    category: "in",
    iconKey: "arrow-up",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [{ kind: "number", key: "fromY", label: "From Y", default: 200, unit: "px" }],
    animatedProperties: ["transform.translateY"],
    tracks: [
      {
        property: "transform.translateY",
        stops: [
          { fraction: 0, value: "${fromY}px" },
          { fraction: 1, value: "0px" },
        ],
      },
    ],
  },
  {
    key: "rotate-in",
    name: "Rotate In",
    category: "in",
    iconKey: "rotate-ccw",
    defaultDuration: 40,
    defaultEasing: { type: "ease-out" },
    params: [{ kind: "number", key: "fromAngle", label: "From Angle", default: -180, unit: "deg" }],
    animatedProperties: ["transform.rotate", "opacity"],
    tracks: [
      {
        property: "transform.rotate",
        stops: [
          { fraction: 0, value: "${fromAngle}deg" },
          { fraction: 1, value: "0deg" },
        ],
      },
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "0" },
          { fraction: 1, value: "1" },
        ],
      },
    ],
  },
  {
    key: "bounce-in",
    name: "Bounce In",
    category: "in",
    iconKey: "trending-up",
    defaultDuration: 60,
    defaultEasing: SPRING_EASING,
    params: [{ kind: "number", key: "fromScale", label: "From Scale", default: 0.3 }],
    animatedProperties: ["transform.scale", "opacity"],
    tracks: [
      {
        property: "transform.scale",
        stops: [
          { fraction: 0, value: "${fromScale}" },
          { fraction: 0.25, value: "1.05" },
          { fraction: 0.5, value: "0.9" },
          { fraction: 0.75, value: "1.03" },
          { fraction: 1, value: "1" },
        ],
      },
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "0" },
          { fraction: 1, value: "1" },
        ],
      },
    ],
  },

  // ── OUT ───────────────────────────────────────────────────────────────────
  {
    key: "fade-out",
    name: "Fade Out",
    category: "out",
    iconKey: "eye-off",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in" },
    params: [
      { kind: "number", key: "fromOpacity", label: "From", default: 1, min: 0, max: 1 },
      { kind: "number", key: "toOpacity", label: "To", default: 0, min: 0, max: 1 },
    ],
    animatedProperties: ["opacity"],
    tracks: [
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "${fromOpacity}" },
          { fraction: 1, value: "${toOpacity}" },
        ],
      },
    ],
  },
  {
    key: "slide-out-left",
    name: "Slide Out Left",
    category: "out",
    iconKey: "arrow-left",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in" },
    params: [{ kind: "number", key: "toX", label: "To X", default: -300, unit: "px" }],
    animatedProperties: ["transform.translateX"],
    tracks: [
      {
        property: "transform.translateX",
        stops: [
          { fraction: 0, value: "0px" },
          { fraction: 1, value: "${toX}px" },
        ],
      },
    ],
  },
  {
    key: "slide-out-right",
    name: "Slide Out Right",
    category: "out",
    iconKey: "arrow-right",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in" },
    params: [{ kind: "number", key: "toX", label: "To X", default: 300, unit: "px" }],
    animatedProperties: ["transform.translateX"],
    tracks: [
      {
        property: "transform.translateX",
        stops: [
          { fraction: 0, value: "0px" },
          { fraction: 1, value: "${toX}px" },
        ],
      },
    ],
  },
  {
    key: "scale-out",
    name: "Scale Out",
    category: "out",
    iconKey: "minimize",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in" },
    params: [
      { kind: "number", key: "fromScale", label: "From Scale", default: 1 },
      { kind: "number", key: "toScale", label: "To Scale", default: 0.8 },
    ],
    animatedProperties: ["transform.scale"],
    tracks: [
      {
        property: "transform.scale",
        stops: [
          { fraction: 0, value: "${fromScale}" },
          { fraction: 1, value: "${toScale}" },
        ],
      },
    ],
  },
  {
    key: "slide-out-up",
    name: "Slide Out Up",
    category: "out",
    iconKey: "arrow-up",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in" },
    params: [{ kind: "number", key: "toY", label: "To Y", default: -200, unit: "px" }],
    animatedProperties: ["transform.translateY"],
    tracks: [
      {
        property: "transform.translateY",
        stops: [
          { fraction: 0, value: "0px" },
          { fraction: 1, value: "${toY}px" },
        ],
      },
    ],
  },
  {
    key: "slide-out-down",
    name: "Slide Out Down",
    category: "out",
    iconKey: "arrow-down",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in" },
    params: [{ kind: "number", key: "toY", label: "To Y", default: 200, unit: "px" }],
    animatedProperties: ["transform.translateY"],
    tracks: [
      {
        property: "transform.translateY",
        stops: [
          { fraction: 0, value: "0px" },
          { fraction: 1, value: "${toY}px" },
        ],
      },
    ],
  },
  {
    key: "rotate-out",
    name: "Rotate Out",
    category: "out",
    iconKey: "rotate-cw",
    defaultDuration: 40,
    defaultEasing: { type: "ease-in" },
    params: [{ kind: "number", key: "toAngle", label: "To Angle", default: 180, unit: "deg" }],
    animatedProperties: ["transform.rotate", "opacity"],
    tracks: [
      {
        property: "transform.rotate",
        stops: [
          { fraction: 0, value: "0deg" },
          { fraction: 1, value: "${toAngle}deg" },
        ],
      },
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "1" },
          { fraction: 1, value: "0" },
        ],
      },
    ],
  },
  {
    key: "bounce-out",
    name: "Bounce Out",
    category: "out",
    iconKey: "trending-down",
    defaultDuration: 60,
    defaultEasing: SPRING_EASING,
    params: [{ kind: "number", key: "toScale", label: "To Scale", default: 0.3 }],
    animatedProperties: ["transform.scale", "opacity"],
    tracks: [
      {
        property: "transform.scale",
        stops: [
          { fraction: 0, value: "1" },
          { fraction: 0.25, value: "0.9" },
          { fraction: 0.5, value: "1.05" },
          { fraction: 0.75, value: "0.95" },
          { fraction: 1, value: "${toScale}" },
        ],
      },
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "1" },
          { fraction: 1, value: "0" },
        ],
      },
    ],
  },

  // ── EFFECT ────────────────────────────────────────────────────────────────
  {
    key: "pulse",
    name: "Pulse",
    category: "effect",
    iconKey: "activity",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in-out" },
    params: [{ kind: "number", key: "peakScale", label: "Peak Scale", default: 1.1 }],
    animatedProperties: ["transform.scale"],
    tracks: [
      {
        property: "transform.scale",
        stops: [
          { fraction: 0, value: "1" },
          { fraction: 0.5, value: "${peakScale}" },
          { fraction: 1, value: "1" },
        ],
      },
    ],
  },
  {
    key: "shake",
    name: "Shake",
    category: "effect",
    iconKey: "zap",
    defaultDuration: 20,
    defaultEasing: { type: "ease-in-out" },
    params: [{ kind: "number", key: "amplitude", label: "Amplitude", default: 8, unit: "px" }],
    animatedProperties: ["transform.translateX"],
    tracks: [
      {
        property: "transform.translateX",
        stops: [
          { fraction: 0, value: "0px" },
          { fraction: 0.25, value: "${amplitude}px" },
          { fraction: 0.5, value: "${-amplitude}px" },
          { fraction: 0.75, value: "${amplitude}px" },
          { fraction: 1, value: "0px" },
        ],
      },
    ],
  },
  {
    key: "wiggle",
    name: "Wiggle",
    category: "effect",
    iconKey: "refresh-cw",
    defaultDuration: 20,
    defaultEasing: { type: "ease-in-out" },
    params: [{ kind: "number", key: "amplitude", label: "Amplitude", default: 5, unit: "deg" }],
    animatedProperties: ["transform.rotate"],
    tracks: [
      {
        property: "transform.rotate",
        stops: [
          { fraction: 0, value: "0deg" },
          { fraction: 0.25, value: "${amplitude}deg" },
          { fraction: 0.5, value: "${-amplitude}deg" },
          { fraction: 0.75, value: "${amplitude}deg" },
          { fraction: 1, value: "0deg" },
        ],
      },
    ],
  },
  {
    key: "bounce",
    name: "Bounce",
    category: "effect",
    iconKey: "chevrons-up",
    defaultDuration: 40,
    defaultEasing: { type: "ease-in-out" },
    params: [{ kind: "number", key: "peak", label: "Peak Y", default: -30, unit: "px" }],
    animatedProperties: ["transform.translateY"],
    tracks: [
      {
        property: "transform.translateY",
        stops: [
          { fraction: 0, value: "0px" },
          { fraction: 0.25, value: "${peak}px" },
          { fraction: 0.5, value: "0px" },
          { fraction: 0.75, value: "${round(peak / 2)}px" },
          { fraction: 1, value: "0px" },
        ],
      },
    ],
  },
  {
    key: "heart-beat",
    name: "Heart Beat",
    category: "effect",
    iconKey: "heart",
    defaultDuration: 30,
    defaultEasing: { type: "ease-in-out" },
    params: [{ kind: "number", key: "peakScale", label: "Peak Scale", default: 1.3 }],
    animatedProperties: ["transform.scale"],
    tracks: [
      {
        property: "transform.scale",
        stops: [
          { fraction: 0, value: "1" },
          { fraction: 0.14, value: "${peakScale}" },
          { fraction: 0.28, value: "1" },
          { fraction: 0.42, value: "${peakScale}" },
          { fraction: 1, value: "1" },
        ],
      },
    ],
  },
  {
    key: "swing",
    name: "Swing",
    category: "effect",
    iconKey: "wind",
    defaultDuration: 40,
    defaultEasing: { type: "ease-in-out" },
    params: [{ kind: "number", key: "amplitude", label: "Amplitude", default: 15, unit: "deg" }],
    animatedProperties: ["transform.rotate"],
    tracks: [
      {
        property: "transform.rotate",
        stops: [
          { fraction: 0, value: "0deg" },
          { fraction: 0.25, value: "${amplitude}deg" },
          { fraction: 0.5, value: "${-round(amplitude * 0.6)}deg" },
          { fraction: 0.75, value: "${round(amplitude * 0.4)}deg" },
          { fraction: 1, value: "0deg" },
        ],
      },
    ],
  },
  {
    key: "flicker",
    name: "Flicker",
    category: "effect",
    iconKey: "zap",
    defaultDuration: 60,
    defaultEasing: { type: "linear" },
    params: [
      { kind: "number", key: "dimOpacity", label: "Dim Opacity", default: 0.2, min: 0, max: 1 },
    ],
    animatedProperties: ["opacity"],
    tracks: [
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "1" },
          { fraction: 0.1, value: "${dimOpacity}" },
          { fraction: 0.15, value: "1" },
          { fraction: 0.2, value: "${dimOpacity}" },
          { fraction: 0.4, value: "1" },
          { fraction: 0.6, value: "${dimOpacity}" },
          { fraction: 1, value: "1" },
        ],
      },
    ],
  },
] as const;
