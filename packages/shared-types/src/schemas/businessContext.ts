import { z } from "zod";

export const BusinessContextSchema = z.object({
  summary: z.string().default(""),
  audience: z.string().default(""),
  products: z.string().default(""),
  tone: z.string().default(""),
  keyMessages: z.array(z.string()).default([]),
  differentiators: z.array(z.string()).default([]),
  competitors: z.string().default(""),
  notes: z.string().default(""),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
});

export type BusinessContext = z.infer<typeof BusinessContextSchema>;

export const BusinessContextPatchSchema = BusinessContextSchema.omit({
  createdAt: true,
  updatedAt: true,
}).partial();

export type BusinessContextPatch = z.infer<typeof BusinessContextPatchSchema>;

export const DEFAULT_BUSINESS_CONTEXT: BusinessContext = {
  summary: "",
  audience: "",
  products: "",
  tone: "",
  keyMessages: [],
  differentiators: [],
  competitors: "",
  notes: "",
  createdAt: "",
  updatedAt: "",
};

export function isBusinessContextConfigured(ctx: BusinessContext): boolean {
  return (
    ctx.summary.trim().length > 0 ||
    ctx.audience.trim().length > 0 ||
    ctx.products.trim().length > 0
  );
}
