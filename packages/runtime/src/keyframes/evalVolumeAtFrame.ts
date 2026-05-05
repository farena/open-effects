import type { VolumeKeyframe } from "@open-effects/shared-types";
import { evalEasing } from "./easings";

export function evalVolumeAtFrame(
  kfs: VolumeKeyframe[],
  frame: number,
  fps: number,
): number {
  if (kfs.length === 0) return 1;
  const sorted = [...kfs].sort((a, b) => a.frame - b.frame);
  if (frame < sorted[0]!.frame) return sorted[0]!.value;
  if (frame >= sorted[sorted.length - 1]!.frame)
    return sorted[sorted.length - 1]!.value;
  const idx = sorted.findIndex((k) => k.frame > frame);
  const a = sorted[idx - 1]!,
    b = sorted[idx]!;
  if (b.frame === a.frame) return b.value;
  const t = evalEasing(a.easingOut, frame - a.frame, b.frame - a.frame, fps);
  return a.value + (b.value - a.value) * t;
}
