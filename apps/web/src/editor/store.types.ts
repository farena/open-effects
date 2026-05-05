import type { Project } from "@open-effects/shared-types";
import type { Easing } from "@open-effects/shared-types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface EditorState {
  project: Project;
  selectedSceneId: string | null;
  selectedLayerId: string | null;
  currentFrame: number;
  isPlaying: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
}

export interface EditorActions {
  setProject: (p: Project) => void;
  selectScene: (id: string | null) => void;
  selectLayer: (id: string | null) => void;
  setCurrentFrame: (f: number) => void;
  play: () => void;
  pause: () => void;
  addScene: () => void;
  deleteScene: (sceneId: string) => void;
  reorderScenes: (orderedIds: string[]) => void;
  setSceneDuration: (sceneId: string, durationFrames: number) => void;
  updateSceneName: (sceneId: string, name: string) => void;
  updateSceneBackground: (sceneId: string, background: string) => void;
  adjustSceneBoundaryAt: (sceneId: string, deltaFrames: number) => void;
  addLayer: (sceneId: string) => void;
  deleteLayer: (layerId: string) => void;
  reorderLayers: (sceneId: string, orderedIds: string[]) => void;
  updateLayerHtml: (layerId: string, html: string) => void;
  updateLayerCss: (layerId: string, css: string) => void;
  updateLayerName: (layerId: string, name: string) => void;
  updateLayerFrames: (
    layerId: string,
    startFrame: number,
    endFrame: number,
  ) => void;
  toggleLayerVisible: (layerId: string) => void;
  setSaveStatus: (s: SaveStatus) => void;
  markSaved: () => void;
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
}
