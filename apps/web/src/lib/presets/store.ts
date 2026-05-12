/**
 * Helpers for mapping the AnimationPreset Prisma row to the StoredPreset
 * client/API shape (camelCase + parsed JSON columns).
 */
import type { AnimationPreset as AnimationPresetRow } from "@/generated/prisma/client";
import {
  type StoredPreset,
  type PresetCategory,
  type PresetParam,
  type PresetTrack,
  type PresetDefinition,
} from "@open-effects/shared-types";
import type { Easing } from "@open-effects/shared-types";

export function rowToStoredPreset(row: AnimationPresetRow): StoredPreset {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    category: row.category as PresetCategory,
    iconKey: row.iconKey,
    defaultDuration: row.defaultDuration,
    defaultEasing: row.defaultEasing as unknown as Easing,
    params: row.params as unknown as PresetParam[],
    animatedProperties: row.animatedProperties as unknown as string[],
    tracks: row.tracks as unknown as PresetTrack[],
    isBuiltIn: row.isBuiltIn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Strip the storage-only fields, leaving a PresetDefinition view of the row. */
export function rowToPresetDefinition(row: AnimationPresetRow): PresetDefinition {
  const stored = rowToStoredPreset(row);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, isBuiltIn, createdAt, updatedAt, ...def } = stored;
  return def;
}
