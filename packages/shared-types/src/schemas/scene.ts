import { z } from "zod";
import { LayerSchema } from "./layer";
import { AudioTrackSchema } from "./audio";
import { KeyframeSchema } from "./keyframe";

export const TransitionSchema = z.object({
  type: z.enum([
    "none",
    "fade",
    "slide-left",
    "slide-right",
    "slide-up",
    "slide-down",
  ]),
  durationFrames: z.number().int().min(0).default(15),
});

export const SceneSchema = z.object({
  id: z.string(),
  order: z.number().int().min(0),
  name: z.string().min(1).default("Scene"),
  /** CSS background for the scene stage (e.g. hex or gradient). */
  background: z.string().default("#000000"),
  durationFrames: z.number().int().positive(),
  transitionIn: TransitionSchema.nullable().optional(),
  /** Keyframes applied to the whole scene (local frames 0 … durationFrames−1). */
  keyframes: z.array(KeyframeSchema).default([]),
  layers: z.array(LayerSchema).default([]),
  audioTracks: z.array(AudioTrackSchema).default([]),
});
