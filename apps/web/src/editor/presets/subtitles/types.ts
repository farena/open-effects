import type { Transcript, Keyframe } from "@open-effects/shared-types";

export type SubtitlePresetContext = {
  layerStartFrame: number; // usually 0 unless caller offsets
  fps: number;
};

export type SubtitlePresetOutput = {
  html: string;
  css: string;
  keyframes: Keyframe[];
};

export type SubtitlePreset = {
  key: string; // e.g. "subtitle-fade"
  name: string; // "Fade per segment"
  description: string;
  iconKey: string; // lucide name
  generate(
    transcript: Transcript,
    ctx: SubtitlePresetContext,
  ): SubtitlePresetOutput;
};
