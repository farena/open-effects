import { z } from "zod";
import { SceneSchema } from "./scene";

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  width: z.number().int().positive().max(7680),
  height: z.number().int().positive().max(7680),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
  /**
   * Global stylesheet applied across every scene/layer. Injected as one
   * `<style>` tag at the top of the composition — NOT scoped. Use for shared
   * `@import` font declarations, `@font-face`, shared `@keyframes`, and
   * utility classes.
   */
  css: z.string().optional(),
  scenes: z.array(SceneSchema).default([]),
});

/** Schema for the new-project form (omits server-generated fields). */
export const NewProjectFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .transform((s) => s.trim()),
  width: z
    .number({ invalid_type_error: "Width must be a number" })
    .int("Width must be a whole number")
    .positive("Width must be positive")
    .max(7680, "Width must be ≤ 7680 (8K)"),
  height: z
    .number({ invalid_type_error: "Height must be a number" })
    .int("Height must be a whole number")
    .positive("Height must be positive")
    .max(7680, "Height must be ≤ 7680 (8K)"),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)], {
    errorMap: () => ({ message: "FPS must be 24, 30, or 60" }),
  }),
});
