import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Layer } from "@open-effects/shared-types";
import type { EditorState, EditorActions } from "./store.types";
import { defaultScene, defaultLayer } from "./defaults";

type StoreState = EditorState & EditorActions;

function mutateLayer(
  state: EditorState,
  layerId: string,
  mut: (l: Layer) => void,
): void {
  for (const sc of state.project.scenes) {
    const l = sc.layers.find((x) => x.id === layerId);
    if (l) {
      mut(l);
      return;
    }
  }
}

export const useEditorStore = create<StoreState>()(
  immer((set) => ({
    project: { id: "", name: "", width: 1920, height: 1080, fps: 30, scenes: [] },
    selectedSceneId: null,
    selectedLayerId: null,
    currentFrame: 0,
    isPlaying: false,
    saveStatus: "idle",
    lastSavedAt: null,

    setProject: (p) =>
      set((s) => {
        s.project = p;
        s.selectedSceneId = p.scenes[0]?.id ?? null;
      }),

    selectScene: (id) =>
      set((s) => {
        s.selectedSceneId = id;
        s.selectedLayerId = null;
      }),

    selectLayer: (id) =>
      set((s) => {
        s.selectedLayerId = id;
      }),

    setCurrentFrame: (f) =>
      set((s) => {
        s.currentFrame = f;
      }),

    play: () =>
      set((s) => {
        s.isPlaying = true;
      }),

    pause: () =>
      set((s) => {
        s.isPlaying = false;
      }),

    addScene: () =>
      set((s) => {
        s.project.scenes.push(defaultScene(s.project.scenes.length));
      }),

    deleteScene: (sceneId) =>
      set((s) => {
        s.project.scenes = s.project.scenes
          .filter((sc) => sc.id !== sceneId)
          .map((sc, i) => ({ ...sc, order: i }));
        if (s.selectedSceneId === sceneId) {
          s.selectedSceneId = s.project.scenes[0]?.id ?? null;
        }
      }),

    reorderScenes: (orderedIds) =>
      set((s) => {
        const map = new Map(s.project.scenes.map((sc) => [sc.id, sc]));
        s.project.scenes = orderedIds.map((id, i) => ({
          ...map.get(id)!,
          order: i,
        }));
      }),

    setSceneDuration: (sceneId, durationFrames) =>
      set((s) => {
        const sc = s.project.scenes.find((x) => x.id === sceneId);
        if (!sc) return;
        sc.durationFrames = durationFrames;
        sc.layers.forEach((l) => {
          if (l.endFrame > durationFrames) l.endFrame = durationFrames;
        });
      }),

    addLayer: (sceneId) =>
      set((s) => {
        const sc = s.project.scenes.find((x) => x.id === sceneId);
        if (!sc) return;
        sc.layers.push(defaultLayer(sc.layers.length, sc.durationFrames));
      }),

    deleteLayer: (layerId) =>
      set((s) => {
        for (const sc of s.project.scenes) {
          const before = sc.layers.length;
          sc.layers = sc.layers
            .filter((l) => l.id !== layerId)
            .map((l, i) => ({ ...l, order: i }));
          if (sc.layers.length !== before && s.selectedLayerId === layerId) {
            s.selectedLayerId = null;
          }
        }
      }),

    reorderLayers: (sceneId, orderedIds) =>
      set((s) => {
        const sc = s.project.scenes.find((x) => x.id === sceneId);
        if (!sc) return;
        const map = new Map(sc.layers.map((l) => [l.id, l]));
        sc.layers = orderedIds.map((id, i) => ({ ...map.get(id)!, order: i }));
      }),

    updateLayerHtml: (layerId, html) =>
      set((s) => mutateLayer(s, layerId, (l) => { l.html = html; })),

    updateLayerCss: (layerId, css) =>
      set((s) => mutateLayer(s, layerId, (l) => { l.css = css; })),

    updateLayerName: (layerId, name) =>
      set((s) => mutateLayer(s, layerId, (l) => { l.name = name; })),

    updateLayerFrames: (layerId, startFrame, endFrame) =>
      set((s) =>
        mutateLayer(s, layerId, (l) => {
          l.startFrame = startFrame;
          l.endFrame = endFrame;
        }),
      ),

    setSaveStatus: (status) =>
      set((s) => {
        s.saveStatus = status;
      }),

    markSaved: () =>
      set((s) => {
        s.saveStatus = "saved";
        s.lastSavedAt = Date.now();
      }),
  })),
);
