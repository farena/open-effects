import { newId } from "@/lib/ids";
import type { Scene, Layer } from "@open-effects/shared-types";

export const defaultLayer = (order: number, endFrame: number): Layer => ({
  id: newId(), order, name: `Layer ${order + 1}`,
  html: '<div class="content">New layer</div>',
  css: '.content { color: white; font-size: 48px; padding: 40px; font-family: sans-serif; }',
  startFrame: 0, endFrame, keyframes: []
});

export const defaultScene = (order: number, durationFrames = 90): Scene => ({
  id: newId(), order, durationFrames,
  transitionIn: null,
  layers: [defaultLayer(0, durationFrames)],
  audioTracks: []
});
