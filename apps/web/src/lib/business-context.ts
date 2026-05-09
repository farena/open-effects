import { db } from "./db";
import type {
  BusinessContext,
  BusinessContextPatch,
} from "@open-effects/shared-types";
import { DEFAULT_BUSINESS_CONTEXT } from "@open-effects/shared-types";

const SINGLETON_ID = 1;

function rowToContext(row: {
  summary: string;
  audience: string;
  products: string;
  tone: string;
  keyMessages: unknown;
  differentiators: unknown;
  competitors: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}): BusinessContext {
  return {
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getBusinessContext(): Promise<BusinessContext> {
  const existing = await db.businessContext.findUnique({
    where: { id: SINGLETON_ID },
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
  };

  const upserted = await db.businessContext.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });

  return rowToContext(upserted);
}
