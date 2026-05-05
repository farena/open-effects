import { z } from "zod";
import { SceneSchema } from "./scene";

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
  scenes: z.array(SceneSchema).default([])
});
