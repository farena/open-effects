import type { Project, Transition, Transcript } from "@open-effects/shared-types";
import type {
  Easing,
  Eq,
  SavedComponentPayload,
} from "@open-effects/shared-types";
import type { AnimationPreset } from "./presets/types";
import type { TranscriptJob } from "@/lib/transcript/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface PreviewedAsset {
  id: string;
  path: string;
  filename: string;
  mimeType: string;
  type: string;
}

export interface EditorState {
  project: Project;
  selectedSceneId: string | null;
  selectedLayerId: string | null;
  selectedAudioTrackId: string | null;
  currentFrame: number;
  isPlaying: boolean;
  loopStart: number | null;
  loopEnd: number | null;
  volume: number;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  previewedAsset: PreviewedAsset | null;
  transcriptionStatus: Record<string, TranscriptJob | null>;
}

export interface EditorActions {
  setProject: (p: Project) => void;
  replaceProjectFromServer: (p: Project) => void;
  selectScene: (id: string | null) => void;
  selectLayer: (id: string | null) => void;
  setCurrentFrame: (f: number) => void;
  play: () => void;
  pause: () => void;
  setLoopStart: (f: number | null) => void;
  setLoopEnd: (f: number | null) => void;
  clearLoopRange: () => void;
  setVolume: (v: number) => void;
  addScene: () => void;
  deleteScene: (sceneId: string) => void;
  reorderScenes: (orderedIds: string[]) => void;
  setSceneDuration: (sceneId: string, durationFrames: number) => void;
  updateSceneName: (sceneId: string, name: string) => void;
  updateSceneBackground: (sceneId: string, background: string) => void;
  updateProjectName: (name: string) => void;
  updateProjectCss: (css: string) => void;
  adjustSceneBoundaryAt: (sceneId: string, deltaFrames: number) => void;
  addLayer: (sceneId: string) => void;
  addMediaLayer: (
    sceneId: string,
    media: { kind: "image" | "video"; path: string; filename: string },
  ) => void;
  createSubtitleLayerFromTranscript: (
    sceneId: string,
    trackId: string,
    transcript: Transcript,
    presetKey: string,
  ) => void;
  updateSubtitleTranscript: (layerId: string, transcript: Transcript) => void;
  regenerateSubtitleLayer: (layerId: string) => void;
  setSubtitleManualOverride: (layerId: string, value: boolean) => void;
  setSubtitlePreset: (layerId: string, presetKey: string) => void;
  deleteLayer: (layerId: string) => void;
  duplicateLayer: (layerId: string) => void;
  reorderLayers: (sceneId: string, orderedIds: string[]) => void;
  updateLayerHtml: (layerId: string, html: string) => void;
  updateLayerCss: (layerId: string, css: string) => void;
  updateSubtitlePresetCss: (layerId: string, css: string) => void;
  updateLayerName: (layerId: string, name: string) => void;
  updateLayerFrames: (
    layerId: string,
    startFrame: number,
    endFrame: number,
  ) => void;
  toggleLayerVisible: (layerId: string) => void;
  insertSavedComponent: (
    payload: SavedComponentPayload,
    sceneId?: string,
  ) => void;
  setSaveStatus: (s: SaveStatus) => void;
  markSaved: () => void;
  setPreviewedAsset: (asset: PreviewedAsset | null) => void;
  addKeyframe: (
    layerId: string,
    property: string,
    frame: number,
    value: string,
    easingOut?: Easing,
  ) => void;
  deleteKeyframe: (layerId: string, property: string, frame: number) => void;
  moveKeyframe: (
    layerId: string,
    property: string,
    fromFrame: number,
    toFrame: number,
  ) => void;
  updateKeyframeValue: (
    layerId: string,
    property: string,
    frame: number,
    value: string,
  ) => void;
  updateKeyframeEasing: (
    layerId: string,
    property: string,
    frame: number,
    easingOut: Easing,
  ) => void;
  addSceneKeyframe: (
    sceneId: string,
    property: string,
    frame: number,
    value: string,
    easingOut?: Easing,
  ) => void;
  deleteSceneKeyframe: (
    sceneId: string,
    property: string,
    frame: number,
  ) => void;
  moveSceneKeyframe: (
    sceneId: string,
    property: string,
    fromFrame: number,
    toFrame: number,
  ) => void;
  updateSceneKeyframeValue: (
    sceneId: string,
    property: string,
    frame: number,
    value: string,
  ) => void;
  updateSceneKeyframeEasing: (
    sceneId: string,
    property: string,
    frame: number,
    easingOut: Easing,
  ) => void;
  addAudioTrack: (
    sceneId: string,
    asset: { id: string; path: string; durationFrames: number },
  ) => void;
  removeAudioTrack: (trackId: string) => void;
  reorderAudioTracks: (sceneId: string, orderedIds: string[]) => void;
  moveAudioTrack: (trackId: string, startFrame: number) => void;
  trimAudioTrack: (trackId: string, trimStart: number, trimEnd: number) => void;
  selectAudioTrack: (id: string | null) => void;
  addVolumeKeyframe: (
    trackId: string,
    frame: number,
    value: number,
    easingOut?: Easing,
  ) => void;
  deleteVolumeKeyframe: (trackId: string, frame: number) => void;
  moveVolumeKeyframe: (
    trackId: string,
    fromFrame: number,
    toFrame: number,
  ) => void;
  updateVolumeKeyframeValue: (
    trackId: string,
    frame: number,
    value: number,
  ) => void;
  updateVolumeKeyframeEasing: (
    trackId: string,
    frame: number,
    easingOut: Easing,
  ) => void;
  setAudioTrackEq: (trackId: string, eq: Eq | null) => void;
  toggleAudioTrackMute: (trackId: string) => void;
  setSceneTransition: (
    sceneId: string,
    transitionIn: Transition | null,
  ) => void;
  splitAudioTrack: (trackId: string, splitFrameLocal: number) => void;
  applyAnimationPresetToLayer: (
    layerId: string,
    preset: AnimationPreset,
    params: {
      duration: number;
      easing: Easing;
      values: Record<string, number | string>;
      anchorFrame?: number;
      replaceConflicts?: boolean;
    },
  ) => void;
  transcribeAudioTrack: (
    trackId: string,
    opts?: { model?: string; language?: string },
  ) => Promise<void>;
}
