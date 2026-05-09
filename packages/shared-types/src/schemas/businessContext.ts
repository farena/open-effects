import { z } from "zod";

export const BusinessContextSchema = z.object({
  companyName: z.string().default(""),
  summary: z.string().default(""),
  audience: z.string().default(""),
  products: z.string().default(""),
  tone: z.string().default(""),
  keyMessages: z.array(z.string()).default([]),
  differentiators: z.array(z.string()).default([]),
  competitors: z.string().default(""),
  notes: z.string().default(""),
  primaryColor: z.string().nullable().default(null),
  secondaryColor: z.string().nullable().default(null),
  accentColor: z.string().nullable().default(null),
  logoLightAssetId: z.string().nullable().default(null),
  logoLightAssetPath: z.string().nullable().default(null),
  logoDarkAssetId: z.string().nullable().default(null),
  logoDarkAssetPath: z.string().nullable().default(null),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
});

export type BusinessContext = z.infer<typeof BusinessContextSchema>;

export const BusinessContextPatchSchema = BusinessContextSchema.omit({
  createdAt: true,
  updatedAt: true,
  logoLightAssetPath: true,
  logoDarkAssetPath: true,
}).partial();

export type BusinessContextPatch = z.infer<typeof BusinessContextPatchSchema>;

export const DEFAULT_BUSINESS_CONTEXT: BusinessContext = {
  companyName: "",
  summary: "",
  audience: "",
  products: "",
  tone: "",
  keyMessages: [],
  differentiators: [],
  competitors: "",
  notes: "",
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  logoLightAssetId: null,
  logoLightAssetPath: null,
  logoDarkAssetId: null,
  logoDarkAssetPath: null,
  createdAt: "",
  updatedAt: "",
};

export function isBusinessContextConfigured(ctx: BusinessContext): boolean {
  return (
    ctx.companyName.trim().length > 0 ||
    ctx.summary.trim().length > 0 ||
    ctx.audience.trim().length > 0 ||
    ctx.products.trim().length > 0
  );
}
