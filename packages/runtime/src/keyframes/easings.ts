import BezierEasing from "bezier-easing";
import { spring } from "remotion";
import type { Easing } from "@open-effects/shared-types";

const easeIn    = BezierEasing(0.42, 0, 1, 1);
const easeOut   = BezierEasing(0, 0, 0.58, 1);
const easeInOut = BezierEasing(0.42, 0, 0.58, 1);

export function evalEasing(e: Easing, frameInSegment: number, segmentDuration: number, fps: number): number {
  if (segmentDuration <= 0) return 1;
  const t = Math.min(1, Math.max(0, frameInSegment / segmentDuration));
  switch (e.type) {
    case "linear":       return t;
    case "ease-in":      return easeIn(t);
    case "ease-out":     return easeOut(t);
    case "ease-in-out":  return easeInOut(t);
    case "cubic-bezier": {
      const [p1, p2, p3, p4] = e.params;
      return BezierEasing(p1, p2, p3, p4)(t);
    }
    case "spring": {
      return spring({
        frame: frameInSegment,
        fps,
        config: e.params,
        durationInFrames: segmentDuration
      });
    }
    default: {
      const _exhaustive: never = e;
      throw new Error(`Unknown easing type: ${(_exhaustive as { type: string }).type}`);
    }
  }
}
