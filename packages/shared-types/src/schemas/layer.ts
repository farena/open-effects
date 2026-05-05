import { z } from "zod";
import { KeyframeSchema } from "./keyframe";

export const LayerSchema = z.object({
  id: z.string(),
  order: z.number().int().min(0),
  name: z.string(),
  html: z.string(),
  css: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
  keyframes: z.array(KeyframeSchema).default([])
}).refine((l) => l.endFrame >= l.startFrame, {
  message: "endFrame must be >= startFrame",
  path: ["endFrame"]
});

export type Layer = z.infer<typeof LayerSchema>;
