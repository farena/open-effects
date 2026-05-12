import { z } from "zod";
import { EasingSchema } from "./easing";

export const PresetCategorySchema = z.enum(["in", "out", "effect"]);

export const PresetParamSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("number"),
    key: z.string().min(1),
    label: z.string().min(1),
    default: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
    unit: z.string().optional(),
  }),
  z.object({
    kind: z.literal("text"),
    key: z.string().min(1),
    label: z.string().min(1),
    default: z.string(),
  }),
]);

export const PresetStopSchema = z.object({
  fraction: z.number().min(0).max(1),
  value: z.string().min(1),
});

export const PresetTrackSchema = z.object({
  property: z.string().min(1),
  stops: z.array(PresetStopSchema).min(2),
});

export const PresetDefinitionSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/, {
    message: "key must be kebab-case (a-z, 0-9, hyphen)",
  }),
  name: z.string().min(1),
  category: PresetCategorySchema,
  iconKey: z.string().min(1),
  defaultDuration: z.number().int().positive(),
  defaultEasing: EasingSchema,
  params: z.array(PresetParamSchema),
  animatedProperties: z.array(z.string().min(1)).min(1),
  tracks: z.array(PresetTrackSchema).min(1),
});

export const StoredPresetSchema = PresetDefinitionSchema.extend({
  id: z.string(),
  isBuiltIn: z.boolean(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type PresetCategory = z.infer<typeof PresetCategorySchema>;
export type PresetParam = z.infer<typeof PresetParamSchema>;
export type PresetStop = z.infer<typeof PresetStopSchema>;
export type PresetTrack = z.infer<typeof PresetTrackSchema>;
export type PresetDefinition = z.infer<typeof PresetDefinitionSchema>;
export type StoredPreset = z.infer<typeof StoredPresetSchema>;
