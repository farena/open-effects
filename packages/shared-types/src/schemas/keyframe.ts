import { z } from "zod";
import { EasingSchema } from "./easing";

export const KeyframeSchema = z.object({
  id: z.string().optional(),
  frame: z.number().int().min(0),
  property: z.string().min(1),
  value: z.string(),
  easingOut: EasingSchema
});

export const VolumeKeyframeSchema = z.object({
  id: z.string().optional(),
  frame: z.number().int().min(0),
  value: z.number().min(0).max(1),
  easingOut: EasingSchema
});

export type Keyframe = z.infer<typeof KeyframeSchema>;
export type VolumeKeyframe = z.infer<typeof VolumeKeyframeSchema>;
