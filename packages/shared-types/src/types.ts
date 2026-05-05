import type { z } from "zod";
import type { EasingSchema } from "./schemas/easing";
import type { KeyframeSchema, VolumeKeyframeSchema } from "./schemas/keyframe";
import type { LayerSchema } from "./schemas/layer";
import type { AssetSchema, AudioTrackSchema, EqSchema } from "./schemas/audio";
import type { SceneSchema, TransitionSchema } from "./schemas/scene";
import type { ProjectSchema } from "./schemas/project";

export type Easing = z.infer<typeof EasingSchema>;
export type Keyframe = z.infer<typeof KeyframeSchema>;
export type VolumeKeyframe = z.infer<typeof VolumeKeyframeSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type AudioTrack = z.infer<typeof AudioTrackSchema>;
export type Eq = z.infer<typeof EqSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type Project = z.infer<typeof ProjectSchema>;
