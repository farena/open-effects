import { CUSTOM_KEY_REFERENCE_PATTERN } from "@open-effects/shared-types";

/**
 * Replaces `$KEY` references inside a template (HTML or CSS string) with the
 * corresponding values from `values`. References whose key is missing from the
 * map are left as-is so the issue is visible at render time.
 */
export function substituteCustomValues(
  template: string,
  values: Record<string, string>,
): string {
  if (!template) return template;
  return template.replace(CUSTOM_KEY_REFERENCE_PATTERN, (match, key: string) => {
    return key in values ? values[key] : match;
  });
}
