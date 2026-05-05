import { z } from "zod";
import { VolumeKeyframeSchema } from "./keyframe";

export const AssetTypeSchema = z.enum(["image", "audio", "video", "font"]);

export const AssetSchema = z.object({
  id: z.string(),
  type: AssetTypeSchema,
  filename: z.string(),
  path: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  sha256: z.string().optional(),
});

export const EqSchema = z.object({
  low: z.number(),
  mid: z.number(),
  high: z.number(),
  presence: z.number(),
});

export const AudioTrackSchema = z
  .object({
    id: z.string(),
    assetId: z.string(),
    assetPath: z.string(),
    assetSha256: z.string().optional(),
    startFrame: z.number().int().min(0),
    trimStart: z.number().int().min(0),
    trimEnd: z.number().int().min(0),
    eq: EqSchema.nullable().optional(),
    volumeKeyframes: z.array(VolumeKeyframeSchema).default([]),
  })
  .refine((t) => t.trimEnd > t.trimStart, {
    message: "trimEnd must be > trimStart",
    path: ["trimEnd"],
  });
