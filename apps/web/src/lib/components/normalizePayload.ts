import type { Layer } from "@open-effects/shared-types";

export function normalizePayload(layers: Layer[]): { layers: Layer[] } {
  if (layers.length === 0)
    throw new Error("normalizePayload requires ≥1 layer");
  const minStart = Math.min(...layers.map((l) => l.startFrame));
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  return {
    layers: sorted.map((l, i) => ({
      ...l,
      order: i,
      startFrame: l.startFrame - minStart,
      endFrame: l.endFrame - minStart,
      // keyframes already layer-local (Stage 4), no change needed
    })),
  };
}
