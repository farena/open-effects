import {
  type Keyframe,
  extractCustomKey,
  isCustomProperty,
} from "@open-effects/shared-types";
import { evalEasing } from "./easings";
import { parseNumeric, serializeNumeric, lerp } from "./parsers";

/**
 * Interpolates custom keyframes (those with `property = "custom.<KEY>"`) at the
 * given frame. Returns a `{ KEY -> value }` map suitable for substitution into
 * a layer's HTML/CSS via the `$KEY` placeholder.
 *
 * Custom values are always interpolated as plain numbers; the user can append
 * units (`px`, `%`, `deg`, ...) directly in the template, e.g.:
 *   `transform: translateX($POSITION_Xpx);`
 */
export function computeCustomValuesAtFrame(
  keyframes: Keyframe[],
  frame: number,
  fps: number,
): Record<string, string> {
  if (keyframes.length === 0) return {};

  const byKey = new Map<string, Keyframe[]>();
  for (const kf of keyframes) {
    if (!isCustomProperty(kf.property)) continue;
    const key = extractCustomKey(kf.property);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(kf);
  }

  const out: Record<string, string> = {};
  for (const [key, kfs] of byKey) {
    const sorted = [...kfs].sort((a, b) => a.frame - b.frame);
    let value: string;

    if (frame <= sorted[0].frame) {
      value = sorted[0].value;
    } else if (frame >= sorted[sorted.length - 1].frame) {
      value = sorted[sorted.length - 1].value;
    } else {
      const idx = sorted.findIndex((k) => k.frame > frame);
      const a = sorted[idx - 1];
      const b = sorted[idx];
      const t = evalEasing(a.easingOut, frame - a.frame, b.frame - a.frame, fps);
      value = serializeNumeric(lerp(parseNumeric(a.value), parseNumeric(b.value), t));
    }

    out[key] = value;
  }

  return out;
}
