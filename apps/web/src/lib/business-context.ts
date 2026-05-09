import { db } from "./db";
import type {
  BusinessContext,
  BusinessContextPatch,
} from "@open-effects/shared-types";
import { DEFAULT_BUSINESS_CONTEXT } from "@open-effects/shared-types";

const SINGLETON_ID = 1;

type AssetRow = { id: string; path: string } | null;

function rowToContext(row: {
  companyName: string;
  summary: string;
  audience: string;
  products: string;
  tone: string;
  keyMessages: unknown;
  differentiators: unknown;
  competitors: string;
  notes: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logoLightAssetId: string | null;
  logoLightAsset?: AssetRow;
  logoDarkAssetId: string | null;
  logoDarkAsset?: AssetRow;
  createdAt: Date;
  updatedAt: Date;
}): BusinessContext {
  return {
    companyName: row.companyName,
    summary: row.summary,
    audience: row.audience,
    products: row.products,
    tone: row.tone,
    keyMessages: Array.isArray(row.keyMessages)
      ? (row.keyMessages as string[])
      : [],
    differentiators: Array.isArray(row.differentiators)
      ? (row.differentiators as string[])
      : [],
    competitors: row.competitors,
    notes: row.notes,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    logoLightAssetId: row.logoLightAssetId,
    logoLightAssetPath: row.logoLightAsset?.path ?? null,
    logoDarkAssetId: row.logoDarkAssetId,
    logoDarkAssetPath: row.logoDarkAsset?.path ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getBusinessContext(): Promise<BusinessContext> {
  const existing = await db.businessContext.findUnique({
    where: { id: SINGLETON_ID },
    include: { logoLightAsset: true, logoDarkAsset: true },
  });
  if (!existing) return DEFAULT_BUSINESS_CONTEXT;
  return rowToContext(existing);
}

export async function updateBusinessContext(
  patch: BusinessContextPatch,
): Promise<BusinessContext> {
  const existing = await db.businessContext.findUnique({
    where: { id: SINGLETON_ID },
  });

  const data = {
    companyName: patch.companyName ?? existing?.companyName ?? "",
    summary: patch.summary ?? existing?.summary ?? "",
    audience: patch.audience ?? existing?.audience ?? "",
    products: patch.products ?? existing?.products ?? "",
    tone: patch.tone ?? existing?.tone ?? "",
    keyMessages:
      patch.keyMessages ??
      (Array.isArray(existing?.keyMessages)
        ? (existing!.keyMessages as string[])
        : []),
    differentiators:
      patch.differentiators ??
      (Array.isArray(existing?.differentiators)
        ? (existing!.differentiators as string[])
        : []),
    competitors: patch.competitors ?? existing?.competitors ?? "",
    notes: patch.notes ?? existing?.notes ?? "",
    primaryColor:
      patch.primaryColor === undefined
        ? (existing?.primaryColor ?? null)
        : patch.primaryColor,
    secondaryColor:
      patch.secondaryColor === undefined
        ? (existing?.secondaryColor ?? null)
        : patch.secondaryColor,
    accentColor:
      patch.accentColor === undefined
        ? (existing?.accentColor ?? null)
        : patch.accentColor,
    logoLightAssetId:
      patch.logoLightAssetId === undefined
        ? (existing?.logoLightAssetId ?? null)
        : patch.logoLightAssetId,
    logoDarkAssetId:
      patch.logoDarkAssetId === undefined
        ? (existing?.logoDarkAssetId ?? null)
        : patch.logoDarkAssetId,
  };

  const upserted = await db.businessContext.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
    include: { logoLightAsset: true, logoDarkAsset: true },
  });

  return rowToContext(upserted);
}
