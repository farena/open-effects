import { z } from "zod";
import { LayerSchema } from "./layer";

export const SavedComponentPayloadSchema = z.object({
  layers: z.array(LayerSchema).min(1),
});

export const SavedComponentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  preview: z.string().nullable().optional(),
  payload: SavedComponentPayloadSchema,
  createdAt: z.coerce.date().optional(),
});

export type SavedComponentPayload = z.infer<typeof SavedComponentPayloadSchema>;
export type SavedComponent = z.infer<typeof SavedComponentSchema>;
