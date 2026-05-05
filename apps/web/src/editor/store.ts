import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Layer, Scene } from "@open-effects/shared-types";
import type { EditorState, EditorActions } from "./store.types";
import { defaultScene, defaultLayer } from "./defaults";
import { ANIMATABLE_KEYS } from "@open-effects/runtime";
import { newId } from "@/lib/ids";

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

function mutateScene(
  state: EditorState,
  sceneId: string,
  mut: (sc: Scene) => void,
): void {
  const sc = state.project.scenes.find((x) => x.id === sceneId);
  if (sc) mut(sc);
}

export const useEditorStore = create<StoreState>()(
  immer((set) => ({
    project: {
      id: "",
      name: "",
      width: 1920,
      height: 1080,
      fps: 30,
      scenes: [],
    },
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
        if (id) {
          for (const sc of s.project.scenes) {
            if (sc.layers.some((l) => l.id === id)) {
              s.selectedSceneId = sc.id;
              break;
            }
          }
        }
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
          if (l.startFrame > durationFrames - 1) {
            l.startFrame = Math.max(0, durationFrames - 1);
          }
          if (l.endFrame <= l.startFrame) {
            l.endFrame = Math.min(durationFrames, l.startFrame + 1);
          }
        });
      }),

    updateSceneName: (sceneId, name) =>
      set((s) =>
        mutateScene(s, sceneId, (sc) => {
          const t = name.trim();
          if (t.length > 0) sc.name = t;
        }),
      ),

    updateSceneBackground: (sceneId, background) =>
      set((s) =>
        mutateScene(s, sceneId, (sc) => {
          sc.background = background;
        }),
      ),

    adjustSceneBoundaryAt: (sceneId, deltaFrames) =>
      set((s) => {
        const ordered = [...s.project.scenes].sort((a, b) => a.order - b.order);
        const i = ordered.findIndex((x) => x.id === sceneId);
        if (i <= 0) return;
        const prev = ordered[i - 1]!;
        const curr = ordered[i]!;
        const newPrev = prev.durationFrames + deltaFrames;
        const newCurr = curr.durationFrames - deltaFrames;
        if (newPrev < 1 || newCurr < 1) return;
        prev.durationFrames = newPrev;
        curr.durationFrames = newCurr;
        for (const sc of [prev, curr]) {
          sc.layers.forEach((l) => {
            if (l.endFrame > sc.durationFrames) l.endFrame = sc.durationFrames;
            if (l.startFrame > sc.durationFrames - 1) {
              l.startFrame = Math.max(0, sc.durationFrames - 1);
            }
            if (l.endFrame <= l.startFrame) {
              l.endFrame = Math.min(sc.durationFrames, l.startFrame + 1);
            }
          });
        }
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
      set((s) =>
        mutateLayer(s, layerId, (l) => {
          l.html = html;
        }),
      ),

    updateLayerCss: (layerId, css) =>
      set((s) =>
        mutateLayer(s, layerId, (l) => {
          l.css = css;
        }),
      ),

    updateLayerName: (layerId, name) =>
      set((s) =>
        mutateLayer(s, layerId, (l) => {
          l.name = name;
        }),
      ),

    updateLayerFrames: (layerId, startFrame, endFrame) =>
      set((s) =>
        mutateLayer(s, layerId, (l) => {
          l.startFrame = startFrame;
          l.endFrame = endFrame;
        }),
      ),

    toggleLayerVisible: (layerId) =>
      set((s) =>
        mutateLayer(s, layerId, (l) => {
          l.visible = !l.visible;
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

    addKeyframe: (layerId, property, frame, value, easingOut) =>
      set((s) => {
        if (!ANIMATABLE_KEYS.includes(property)) {
          console.warn(`Unknown animatable property: ${property}`);
          return;
        }
        mutateLayer(s, layerId, (l) => {
          const existing = l.keyframes.find(
            (k) => k.property === property && k.frame === frame,
          );
          if (existing) {
            existing.value = value;
            if (easingOut) existing.easingOut = easingOut;
            return;
          }
          l.keyframes.push({
            id: newId(),
            frame,
            property,
            value,
            easingOut: easingOut ?? { type: "linear" },
          });
        });
      }),

    deleteKeyframe: (layerId, property, frame) =>
      set((s) =>
        mutateLayer(s, layerId, (l) => {
          l.keyframes = l.keyframes.filter(
            (k) => !(k.property === property && k.frame === frame),
          );
        }),
      ),

    moveKeyframe: (layerId, property, fromFrame, toFrame) =>
      set((s) =>
        mutateLayer(s, layerId, (l) => {
          const collision = l.keyframes.find(
            (k) => k.property === property && k.frame === toFrame,
          );
          if (collision) return;
          const kf = l.keyframes.find(
            (k) => k.property === property && k.frame === fromFrame,
          );
          if (kf) kf.frame = toFrame;
        }),
      ),

    updateKeyframeValue: (layerId, property, frame, value) =>
      set((s) =>
        mutateLayer(s, layerId, (l) => {
          const kf = l.keyframes.find(
            (k) => k.property === property && k.frame === frame,
          );
          if (kf) kf.value = value;
        }),
      ),

    updateKeyframeEasing: (layerId, property, frame, easingOut) =>
      set((s) =>
        mutateLayer(s, layerId, (l) => {
          const kf = l.keyframes.find(
            (k) => k.property === property && k.frame === frame,
          );
          if (kf) kf.easingOut = easingOut;
        }),
      ),

    addSceneKeyframe: (sceneId, property, frame, value, easingOut) =>
      set((s) => {
        if (!ANIMATABLE_KEYS.includes(property)) {
          console.warn(`Unknown animatable property: ${property}`);
          return;
        }
        mutateScene(s, sceneId, (sc) => {
          const hi = Math.max(0, sc.durationFrames - 1);
          const f = Math.max(0, Math.min(hi, frame));
          const existing = sc.keyframes.find(
            (k) => k.property === property && k.frame === f,
          );
          if (existing) {
            existing.value = value;
            if (easingOut) existing.easingOut = easingOut;
            return;
          }
          sc.keyframes.push({
            id: newId(),
            frame: f,
            property,
            value,
            easingOut: easingOut ?? { type: "linear" },
          });
        });
      }),

    deleteSceneKeyframe: (sceneId, property, frame) =>
      set((s) =>
        mutateScene(s, sceneId, (sc) => {
          sc.keyframes = sc.keyframes.filter(
            (k) => !(k.property === property && k.frame === frame),
          );
        }),
      ),

    moveSceneKeyframe: (sceneId, property, fromFrame, toFrame) =>
      set((s) =>
        mutateScene(s, sceneId, (sc) => {
          const hi = Math.max(0, sc.durationFrames - 1);
          const tf = Math.max(0, Math.min(hi, toFrame));
          const collision = sc.keyframes.find(
            (k) => k.property === property && k.frame === tf,
          );
          if (collision) return;
          const kf = sc.keyframes.find(
            (k) => k.property === property && k.frame === fromFrame,
          );
          if (kf) kf.frame = tf;
        }),
      ),

    updateSceneKeyframeValue: (sceneId, property, frame, value) =>
      set((s) =>
        mutateScene(s, sceneId, (sc) => {
          const kf = sc.keyframes.find(
            (k) => k.property === property && k.frame === frame,
          );
          if (kf) kf.value = value;
        }),
      ),

    updateSceneKeyframeEasing: (sceneId, property, frame, easingOut) =>
      set((s) =>
        mutateScene(s, sceneId, (sc) => {
          const kf = sc.keyframes.find(
            (k) => k.property === property && k.frame === frame,
          );
          if (kf) kf.easingOut = easingOut;
        }),
      ),
  })),
);
