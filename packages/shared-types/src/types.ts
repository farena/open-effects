import type { z } from "zod";
import type { EasingSchema } from "./schemas/easing";
import type { KeyframeSchema, VolumeKeyframeSchema } from "./schemas/keyframe";
import type { AssetSchema, AudioTrackSchema, EqSchema } from "./schemas/audio";
import type { SceneSchema, TransitionSchema } from "./schemas/scene";
import type { ProjectSchema } from "./schemas/project";

export type Easing = z.infer<typeof EasingSchema>;
export type Keyframe = z.infer<typeof KeyframeSchema>;
export type VolumeKeyframe = z.infer<typeof VolumeKeyframeSchema>;
// Layer, HtmlLayer, SubtitleLayer are exported from ./schemas/layer
export type Asset = z.infer<typeof AssetSchema>;
export type AudioTrack = z.infer<typeof AudioTrackSchema>;
export type Eq = z.infer<typeof EqSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type Project = z.infer<typeof ProjectSchema>;
