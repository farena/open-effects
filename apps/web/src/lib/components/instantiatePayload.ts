import type { SavedComponentPayload, Layer } from "@open-effects/shared-types";
import { newId } from "@/lib/ids";

export function instantiatePayload(
  payload: SavedComponentPayload,
  opts: { currentFrame: number; existingMaxOrder: number },
): Layer[] {
  return payload.layers.map((l, i) => ({
    ...l,
    id: newId(),
    order: opts.existingMaxOrder + 1 + i,
    startFrame: l.startFrame + opts.currentFrame,
    endFrame: l.endFrame + opts.currentFrame,
    keyframes: l.keyframes.map((k) => ({ ...k, id: newId() })),
  }));
}
