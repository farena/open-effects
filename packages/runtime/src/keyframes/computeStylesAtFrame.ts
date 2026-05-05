import type { CSSProperties } from "react";
import type { Keyframe } from "@open-effects/shared-types";
import { PROPERTIES } from "./propertyRegistry";
import { evalEasing } from "./easings";
import {
  parseNumeric,
  parseLengthPx,
  parseAngleDeg,
  serializeNumeric,
  serializeLengthPx,
  serializeAngleDeg,
  lerp
} from "./parsers";
import { mixColor } from "./color";
import { composeTransform } from "./composeTransform";

function interpolatePrimitive(
  type: "numeric" | "length-px" | "angle-deg" | "color",
  a: string,
  b: string,
  t: number
): string {
  switch (type) {
    case "numeric":   return serializeNumeric(lerp(parseNumeric(a), parseNumeric(b), t));
    case "length-px": return serializeLengthPx(lerp(parseLengthPx(a), parseLengthPx(b), t));
    case "angle-deg": return serializeAngleDeg(lerp(parseAngleDeg(a), parseAngleDeg(b), t));
    case "color":     return mixColor(a, b, t);
  }
}

export function computeStylesAtFrame(keyframes: Keyframe[], frame: number, fps: number): CSSProperties {
  if (keyframes.length === 0) return {};

  // Bucket by property
  const byProp = new Map<string, Keyframe[]>();
  for (const kf of keyframes) {
    if (!byProp.has(kf.property)) byProp.set(kf.property, []);
    byProp.get(kf.property)!.push(kf);
  }

  const transformParts: Record<string, string> = {};
  const styles: Record<string, string> = {};

  for (const [propKey, kfs] of byProp) {
    const meta = PROPERTIES[propKey];
    if (!meta) continue;

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
      value = interpolatePrimitive(meta.type, a.value, b.value, t);
    }

    if (meta.subProp) {
      transformParts[meta.subProp] = value;
    } else {
      styles[meta.cssProp as string] = value;
    }
  }

  if (Object.keys(transformParts).length > 0) {
    styles.transform = composeTransform(transformParts);
  }

  return styles as CSSProperties;
}
