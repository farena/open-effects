import type { Easing, Layer, Keyframe } from "@open-effects/shared-types";

export type PresetCategory = "in" | "out" | "effect";

export type PresetParam =
  | { kind: "number"; key: string; label: string; default: number; min?: number; max?: number; unit?: string }
  | { kind: "text";   key: string; label: string; default: string };

export type BuildContext = {
  layer: Layer;
  duration: number;          // clamped frames
  easing: Easing;
  anchorFrame: number;       // resolved per category
  values: Record<string, number | string>;
};

export type AnimationPreset = {
  key: string;               // 'fade-in', stable identifier
  name: string;              // human label
  category: PresetCategory;
  iconKey: string;           // lucide icon name (resolved in UI)
  defaultDuration: number;   // frames
  defaultEasing: Easing;
  params: PresetParam[];
  animatedProperties: string[]; // properties this preset emits keyframes for; used by collision detection
  build: (ctx: BuildContext) => Keyframe[];   // returns keyframes WITHOUT id; ids assigned by builder
};

export type PresetConflict = {
  property: string;
  existingFrames: number[];   // frames in [anchor, anchor+duration]
};
