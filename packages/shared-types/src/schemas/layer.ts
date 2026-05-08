import { z } from "zod";
import { KeyframeSchema } from "./keyframe";

export const LayerSchema = z
  .object({
    id: z.string(),
    order: z.number().int().min(0),
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must be 100 characters or less"),
    html: z.string(),
    css: z.string(),
    startFrame: z.number().int().min(0),
    endFrame: z.number().int().min(0),
    /** When false, the layer is not composited in the preview/render. */
    visible: z.boolean().default(true),
    keyframes: z.array(KeyframeSchema).default([]),
  })
  .refine((l) => l.endFrame >= l.startFrame, {
    message: "endFrame must be >= startFrame",
    path: ["endFrame"],
  });
