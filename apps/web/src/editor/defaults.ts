import { newId } from "@/lib/ids";
import type { Scene, Layer } from "@open-effects/shared-types";

export const defaultLayer = (order: number, endFrame: number): Layer => ({
  id: newId(),
  order,
  name: `Layer ${order + 1}`,
  html: '<div class="content">New layer</div>',
  css: ".content { color: white; font-size: 48px; padding: 40px; font-family: sans-serif; }",
  startFrame: 0,
  endFrame,
  visible: true,
  keyframes: [],
});

export const defaultScene = (order: number, durationFrames = 90): Scene => ({
  id: newId(),
  order,
  name: `Scene ${order + 1}`,
  background: "#000000",
  durationFrames,
  transitionIn: null,
  keyframes: [],
  layers: [defaultLayer(0, durationFrames)],
  audioTracks: [],
});
