import { newId } from "@/lib/ids";
import type { Scene, Layer, SubtitleLayer, Transcript } from "@open-effects/shared-types";
import { getSubtitlePreset } from "@/editor/presets/subtitles/registry";

export const defaultLayer = (order: number, endFrame: number): Layer => ({
  id: newId(),
  type: "html",
  order,
  name: `Layer ${order + 1}`,
  html: '<div class="content">New layer</div>',
  css: ".content { color: white; font-size: 48px; padding: 40px; font-family: sans-serif; }",
  startFrame: 0,
  endFrame,
  visible: true,
  keyframes: [],
});

export const defaultSubtitleLayer = ({
  order,
  audioTrackId,
  transcript,
  presetKey,
  fps,
}: {
  order: number;
  audioTrackId: string;
  transcript: Transcript;
  presetKey: string;
  fps: number;
}): SubtitleLayer => {
  const preset = getSubtitlePreset(presetKey);
  const { html, css, keyframes } = preset.generate(transcript, {
    layerStartFrame: 0,
    fps,
  });
  const endFrame =
    transcript.segments.length > 0
      ? Math.max(...transcript.segments.map((seg) => seg.endFrame))
      : fps * 5;
  return {
    id: newId(),
    type: "subtitle",
    order,
    name: `Subtitle ${order + 1}`,
    html,
    css,
    keyframes,
    startFrame: 0,
    endFrame,
    visible: true,
    subtitle: {
      linkedAudioTrackId: audioTrackId,
      transcript,
      presetKey,
      manualOverride: false,
    },
  };
};

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
