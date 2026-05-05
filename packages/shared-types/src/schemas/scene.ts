import { z } from "zod";
import { LayerSchema } from "./layer";
import { AudioTrackSchema } from "./audio";

export const TransitionSchema = z.object({
  type: z.enum(["none", "fade", "slide-left", "slide-right", "slide-up", "slide-down"]),
  durationFrames: z.number().int().min(0).default(15)
});

export const SceneSchema = z.object({
  id: z.string(),
  order: z.number().int().min(0),
  durationFrames: z.number().int().positive(),
  transitionIn: TransitionSchema.nullable().optional(),
  layers: z.array(LayerSchema).default([]),
  audioTracks: z.array(AudioTrackSchema).default([])
});

export type Scene = z.infer<typeof SceneSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
