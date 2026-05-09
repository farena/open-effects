/**
 * Custom keyframes are user-defined animatable variables that are referenced
 * inside a layer's HTML or CSS via `$KEY` placeholders. They are stored using
 * the existing `Keyframe` schema, with `property = "custom.<KEY>"`.
 */

export const CUSTOM_PROPERTY_PREFIX = "custom.";

/** Allowed format for the user-supplied key name (without the prefix). */
export const CUSTOM_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,31}$/;

/** Regex used to find `$KEY` references inside HTML/CSS templates. */
export const CUSTOM_KEY_REFERENCE_PATTERN = /\$([A-Z][A-Z0-9_]{0,31})/g;

export function isCustomProperty(property: string): boolean {
  return property.startsWith(CUSTOM_PROPERTY_PREFIX);
}

export function customProperty(key: string): string {
  return CUSTOM_PROPERTY_PREFIX + key;
}

/** Extracts the user-facing key from a custom property string. Returns null if not a custom property. */
export function extractCustomKey(property: string): string | null {
  if (!isCustomProperty(property)) return null;
  return property.slice(CUSTOM_PROPERTY_PREFIX.length);
}

export function isValidCustomKey(key: string): boolean {
  return CUSTOM_KEY_PATTERN.test(key);
}
