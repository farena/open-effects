// Built-in animation presets, materialized at runtime from declarative
// PresetDefinitions. The declarative form lives in builtin-definitions.ts and
// is also used to seed the AnimationPreset table.
//
// A subset of the catalog is inspired by animista.net (entrances/exits/
// attention-seekers).
import type { AnimationPreset } from "./types";
import { BUILTIN_PRESET_DEFINITIONS } from "./builtin-definitions";
import { animationPresetFromDefinition } from "./from-definition";

export const ANIMATION_PRESETS: readonly AnimationPreset[] =
  BUILTIN_PRESET_DEFINITIONS.map(animationPresetFromDefinition);
