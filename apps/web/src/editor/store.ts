import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { temporal } from "zundo";
import type { Layer, Scene, Transcript } from "@open-effects/shared-types";
import { isCustomProperty } from "@open-effects/shared-types";
import type { EditorState, EditorActions } from "./store.types";
import { defaultScene, defaultLayer, defaultSubtitleLayer } from "./defaults";
import { ANIMATABLE_KEYS } from "@open-effects/runtime";
import { newId } from "@/lib/ids";
import { instantiatePayload } from "@/lib/components/instantiatePayload";
import {
  buildPresetKeyframes,
  resolveAnchor,
} from "@/editor/presets/build-keyframes";
import { getSubtitlePreset } from "@/editor/presets/subtitles/registry";
import type { TranscriptJob } from "@/lib/transcript/types";

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

function mutateAudioTrack(
  state: EditorState,
  trackId: string,
  mut: (t: NonNullable<Scene["audioTracks"][number]>) => void,
): void {
  for (const sc of state.project.scenes) {
    const t = sc.audioTracks.find((x) => x.id === trackId);
    if (t) {
      mut(t);
      return;
    }
  }
}

export const useEditorStore = create<StoreState>()(
  temporal(
    immer((set, get) => ({
      project: {
        id: "",
        name: "",
        width: 1920,
        height: 1080,
        fps: 30,
        css: "",
        scenes: [],
      },
      selectedSceneId: null,
      selectedLayerId: null,
      selectedAudioTrackId: null,
      currentFrame: 0,
      isPlaying: false,
      loopStart: null,
      loopEnd: null,
      volume: 1,
      saveStatus: "idle",
      lastSavedAt: null,
      previewedAsset: null,
      transcriptionStatus: {},

      setProject: (p) =>
        set((s) => {
          s.project = p;
          s.selectedSceneId = p.scenes[0]?.id ?? null;
        }),

      replaceProjectFromServer: (p) =>
        set((s) => {
          const prevSceneId = s.selectedSceneId;
          const prevLayerId = s.selectedLayerId;
          const prevTrackId = s.selectedAudioTrackId;
          s.project = p;
          const sceneStillExists =
            prevSceneId != null &&
            p.scenes.some((sc) => sc.id === prevSceneId);
          s.selectedSceneId = sceneStillExists
            ? prevSceneId
            : (p.scenes[0]?.id ?? null);
          const layerStillExists =
            prevLayerId != null &&
            p.scenes.some((sc) => sc.layers.some((l) => l.id === prevLayerId));
          if (!layerStillExists) s.selectedLayerId = null;
          const trackStillExists =
            prevTrackId != null &&
            p.scenes.some((sc) =>
              sc.audioTracks.some((t) => t.id === prevTrackId),
            );
          if (!trackStillExists) s.selectedAudioTrackId = null;
        }),

      selectScene: (id) =>
        set((s) => {
          s.selectedSceneId = id;
          s.selectedLayerId = null;
        }),

      selectLayer: (id) =>
        set((s) => {
          s.selectedLayerId = id;
          if (id !== null) s.selectedAudioTrackId = null;
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

      setLoopStart: (f) =>
        set((s) => {
          s.loopStart = f;
          if (
            s.loopStart !== null &&
            s.loopEnd !== null &&
            s.loopEnd <= s.loopStart
          ) {
            s.loopEnd = null;
          }
        }),

      setLoopEnd: (f) =>
        set((s) => {
          s.loopEnd = f;
          if (
            s.loopStart !== null &&
            s.loopEnd !== null &&
            s.loopEnd <= s.loopStart
          ) {
            s.loopStart = null;
          }
        }),

      clearLoopRange: () =>
        set((s) => {
          s.loopStart = null;
          s.loopEnd = null;
        }),

      setVolume: (v) =>
        set((s) => {
          s.volume = Math.max(0, Math.min(1, v));
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

      updateProjectName: (name) =>
        set((s) => {
          const t = name.trim();
          if (t.length > 0) s.project.name = t;
        }),

      updateProjectCss: (css) =>
        set((s) => {
          s.project.css = css;
        }),

      adjustSceneBoundaryAt: (sceneId, deltaFrames) =>
        set((s) => {
          const ordered = [...s.project.scenes].sort(
            (a, b) => a.order - b.order,
          );
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
              if (l.endFrame > sc.durationFrames)
                l.endFrame = sc.durationFrames;
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

      addMediaLayer: (sceneId, media) =>
        set((s) => {
          const sc = s.project.scenes.find((x) => x.id === sceneId);
          if (!sc) return;
          const order = sc.layers.length;
          const baseName = media.filename.replace(/\.[^./]+$/, "");
          const tag =
            media.kind === "video"
              ? `<video class="media" src="${media.path}" autoplay muted loop playsinline></video>`
              : `<img class="media" src="${media.path}" alt="${baseName}" />`;
          sc.layers.push({
            id: newId(),
            order,
            name: baseName || (media.kind === "video" ? "Video" : "Image"),
            html: tag,
            css: ".media { width: 100%; height: 100%; object-fit: contain; display: block; }",
            startFrame: 0,
            endFrame: sc.durationFrames,
            visible: true,
            keyframes: [],
          });
        }),

      createSubtitleLayerFromTranscript: (
        sceneId: string,
        trackId: string,
        transcript: Transcript,
        presetKey: string,
      ) =>
        set((s) => {
          const sc = s.project.scenes.find((x) => x.id === sceneId);
          if (!sc) return;
          const order = sc.layers.length;
          const fps = s.project.fps;
          const layer = defaultSubtitleLayer({
            order,
            audioTrackId: trackId,
            transcript,
            presetKey,
            fps,
          });
          sc.layers.push(layer);
          s.selectedLayerId = layer.id;
          s.selectedAudioTrackId = null;
        }),

      updateSubtitleTranscript: (layerId, transcript) =>
        set((s) =>
          mutateLayer(s, layerId, (l) => {
            if (l.type === "subtitle") {
              l.subtitle.transcript = transcript;
            }
          }),
        ),

      regenerateSubtitleLayer: (layerId) =>
        set((s) =>
          mutateLayer(s, layerId, (l) => {
            if (l.type !== "subtitle") return;
            const preset = getSubtitlePreset(l.subtitle.presetKey);
            const fps = s.project.fps;
            const { html, keyframes } = preset.generate(
              l.subtitle.transcript,
              { layerStartFrame: 0, fps },
            );
            l.html = html;
            l.keyframes = keyframes;
            l.endFrame =
              l.subtitle.transcript.segments.length > 0
                ? Math.max(
                    ...l.subtitle.transcript.segments.map((seg) => seg.endFrame),
                  )
                : l.endFrame;
            l.subtitle.manualOverride = false;
          }),
        ),

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

      duplicateLayer: (layerId) =>
        set((s) => {
          for (const sc of s.project.scenes) {
            const src = sc.layers.find((l) => l.id === layerId);
            if (!src) continue;
            const snapshot = JSON.parse(JSON.stringify(src)) as Layer;
            const copy: Layer = {
              ...snapshot,
              id: newId(),
              name: `${src.name} copy`,
              keyframes: snapshot.keyframes.map((kf) => ({
                frame: kf.frame,
                property: kf.property,
                value: kf.value,
                easingOut: kf.easingOut,
              })),
            };
            const srcIndex = sc.layers.findIndex((l) => l.id === layerId);
            sc.layers.splice(srcIndex + 1, 0, copy);
            sc.layers = sc.layers.map((l, i) => ({ ...l, order: i }));
            s.selectedLayerId = copy.id;
            return;
          }
        }),

      reorderLayers: (sceneId, orderedIds) =>
        set((s) => {
          const sc = s.project.scenes.find((x) => x.id === sceneId);
          if (!sc) return;
          const map = new Map(sc.layers.map((l) => [l.id, l]));
          sc.layers = orderedIds.map((id, i) => ({
            ...map.get(id)!,
            order: i,
          }));
        }),

      updateLayerHtml: (layerId, html) =>
        set((s) =>
          mutateLayer(s, layerId, (l) => {
            l.html = html;
            if (l.type === "subtitle") l.subtitle.manualOverride = true;
          }),
        ),

      updateLayerCss: (layerId, css) =>
        set((s) =>
          mutateLayer(s, layerId, (l) => {
            l.css = css;
            if (l.type === "subtitle") l.subtitle.manualOverride = true;
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

      insertSavedComponent: (payload, sceneId) =>
        set((s) => {
          const targetSceneId =
            sceneId ?? s.selectedSceneId ?? s.project.scenes[0]?.id;
          if (!targetSceneId) return;
          const sc = s.project.scenes.find((x) => x.id === targetSceneId);
          if (!sc) return;
          const existingMaxOrder = sc.layers.reduce(
            (m, l) => Math.max(m, l.order),
            -1,
          );
          const newLayers = instantiatePayload(payload, {
            currentFrame: s.currentFrame,
            existingMaxOrder,
          });
          sc.layers.push(...newLayers);
        }),

      setSaveStatus: (status) =>
        set((s) => {
          s.saveStatus = status;
        }),

      markSaved: () =>
        set((s) => {
          s.saveStatus = "saved";
          s.lastSavedAt = Date.now();
        }),

      setPreviewedAsset: (asset) =>
        set((s) => {
          s.previewedAsset = asset;
        }),

      addKeyframe: (layerId, property, frame, value, easingOut) =>
        set((s) => {
          if (!ANIMATABLE_KEYS.includes(property) && !isCustomProperty(property)) {
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
            } else {
              l.keyframes.push({
                id: newId(),
                frame,
                property,
                value,
                easingOut: easingOut ?? { type: "linear" },
              });
            }
            if (l.type === "subtitle") l.subtitle.manualOverride = true;
          });
        }),

      deleteKeyframe: (layerId, property, frame) =>
        set((s) =>
          mutateLayer(s, layerId, (l) => {
            l.keyframes = l.keyframes.filter(
              (k) => !(k.property === property && k.frame === frame),
            );
            if (l.type === "subtitle") l.subtitle.manualOverride = true;
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
            if (kf) {
              kf.frame = toFrame;
              if (l.type === "subtitle") l.subtitle.manualOverride = true;
            }
          }),
        ),

      updateKeyframeValue: (layerId, property, frame, value) =>
        set((s) =>
          mutateLayer(s, layerId, (l) => {
            const kf = l.keyframes.find(
              (k) => k.property === property && k.frame === frame,
            );
            if (kf) {
              kf.value = value;
              if (l.type === "subtitle") l.subtitle.manualOverride = true;
            }
          }),
        ),

      updateKeyframeEasing: (layerId, property, frame, easingOut) =>
        set((s) =>
          mutateLayer(s, layerId, (l) => {
            const kf = l.keyframes.find(
              (k) => k.property === property && k.frame === frame,
            );
            if (kf) {
              kf.easingOut = easingOut;
              if (l.type === "subtitle") l.subtitle.manualOverride = true;
            }
          }),
        ),

      setSubtitleManualOverride: (layerId, value) =>
        set((s) =>
          mutateLayer(s, layerId, (l) => {
            if (l.type === "subtitle") l.subtitle.manualOverride = value;
          }),
        ),

      setSubtitlePreset: (layerId, presetKey) =>
        set((s) =>
          mutateLayer(s, layerId, (l) => {
            if (l.type !== "subtitle") return;
            l.subtitle.presetKey = presetKey;
            const preset = getSubtitlePreset(presetKey);
            const fps = s.project.fps;
            const { html, keyframes } = preset.generate(l.subtitle.transcript, {
              layerStartFrame: 0,
              fps,
            });
            l.html = html;
            l.keyframes = keyframes;
            l.subtitle.manualOverride = false;
            l.endFrame =
              l.subtitle.transcript.segments.length > 0
                ? Math.max(
                    ...l.subtitle.transcript.segments.map((seg) => seg.endFrame),
                  )
                : l.endFrame;
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

      addAudioTrack: (sceneId, asset) =>
        set((s) => {
          const sc = s.project.scenes.find((x) => x.id === sceneId);
          if (!sc) return;
          sc.audioTracks.push({
            id: newId(),
            assetId: asset.id,
            assetPath: asset.path,
            startFrame: s.currentFrame,
            trimStart: 0,
            trimEnd: asset.durationFrames,
            muted: false,
            eq: null,
            volumeKeyframes: [],
          });
        }),

      removeAudioTrack: (trackId) =>
        set((s) => {
          for (const sc of s.project.scenes) {
            sc.audioTracks = sc.audioTracks.filter((t) => t.id !== trackId);
          }
        }),

      reorderAudioTracks: (sceneId, orderedIds) =>
        set((s) => {
          const sc = s.project.scenes.find((x) => x.id === sceneId);
          if (!sc) return;
          const map = new Map(sc.audioTracks.map((t) => [t.id, t]));
          const next = orderedIds
            .map((id) => map.get(id))
            .filter((t): t is NonNullable<typeof t> => Boolean(t));
          if (next.length !== sc.audioTracks.length) return;
          sc.audioTracks = next;
        }),

      moveAudioTrack: (trackId, startFrame) =>
        set((s) => {
          mutateAudioTrack(s, trackId, (t) => {
            t.startFrame = Math.max(0, startFrame);
          });
        }),

      trimAudioTrack: (trackId, trimStart, trimEnd) =>
        set((s) => {
          if (trimEnd <= trimStart) {
            console.warn("Invalid trim");
            return;
          }
          mutateAudioTrack(s, trackId, (t) => {
            t.trimStart = trimStart;
            t.trimEnd = trimEnd;
          });
        }),

      selectAudioTrack: (id) =>
        set((s) => {
          s.selectedAudioTrackId = id;
          if (id !== null) s.selectedLayerId = null;
        }),

      addVolumeKeyframe: (trackId, frame, value, easingOut) =>
        set((s) =>
          mutateAudioTrack(s, trackId, (t) => {
            const clamped = Math.max(0, Math.min(1, value));
            const existing = t.volumeKeyframes.find((k) => k.frame === frame);
            if (existing) {
              existing.value = clamped;
              if (easingOut) existing.easingOut = easingOut;
              return;
            }
            t.volumeKeyframes.push({
              frame,
              value: clamped,
              easingOut: easingOut ?? { type: "linear" },
            });
          }),
        ),

      deleteVolumeKeyframe: (trackId, frame) =>
        set((s) =>
          mutateAudioTrack(s, trackId, (t) => {
            t.volumeKeyframes = t.volumeKeyframes.filter(
              (k) => k.frame !== frame,
            );
          }),
        ),

      moveVolumeKeyframe: (trackId, fromFrame, toFrame) =>
        set((s) =>
          mutateAudioTrack(s, trackId, (t) => {
            const collision = t.volumeKeyframes.find(
              (k) => k.frame === toFrame,
            );
            if (collision) return;
            const kf = t.volumeKeyframes.find((k) => k.frame === fromFrame);
            if (kf) kf.frame = toFrame;
          }),
        ),

      updateVolumeKeyframeValue: (trackId, frame, value) =>
        set((s) =>
          mutateAudioTrack(s, trackId, (t) => {
            const kf = t.volumeKeyframes.find((k) => k.frame === frame);
            if (kf) kf.value = Math.max(0, Math.min(1, value));
          }),
        ),

      updateVolumeKeyframeEasing: (trackId, frame, easingOut) =>
        set((s) =>
          mutateAudioTrack(s, trackId, (t) => {
            const kf = t.volumeKeyframes.find((k) => k.frame === frame);
            if (kf) kf.easingOut = easingOut;
          }),
        ),

      setAudioTrackEq: (trackId, eq) =>
        set((s) =>
          mutateAudioTrack(s, trackId, (t) => {
            t.eq = eq;
          }),
        ),

      toggleAudioTrackMute: (trackId) =>
        set((s) =>
          mutateAudioTrack(s, trackId, (t) => {
            t.muted = !t.muted;
          }),
        ),

      setSceneTransition: (sceneId, transitionIn) =>
        set((s) =>
          mutateScene(s, sceneId, (sc) => {
            sc.transitionIn = transitionIn;
          }),
        ),

      // Splitting is purely a store action: creates a sibling track with the
      // same assetId/assetPath, sets trimStart of the new track to the
      // original's trimStart + splitFrameLocal, and clamps the original's
      // trimEnd down to that boundary. Volume keyframes are partitioned by
      // their frame < splitFrameLocal (tie-breaker: keyframes at exactly
      // splitFrameLocal go to the right half). EQ is deep-copied to both.
      //
      // Playback contract: playing both halves end-to-end is sample-equivalent
      // to playing the original. Remotion <Audio> honours startFrom/endAt
      // exactly; FFmpeg at render does the same. Both split halves point to
      // the same asset on disk.
      splitAudioTrack: (trackId, splitFrameLocal) =>
        set((s) => {
          for (const sc of s.project.scenes) {
            const i = sc.audioTracks.findIndex((t) => t.id === trackId);
            if (i < 0) continue;
            const t = sc.audioTracks[i]!;
            const span = t.trimEnd - t.trimStart;
            if (splitFrameLocal <= 0 || splitFrameLocal >= span) {
              console.warn("splitAudioTrack: split outside track range");
              return;
            }
            const splitTrim = t.trimStart + splitFrameLocal;
            const newTrack = {
              ...t,
              id: newId(),
              startFrame: t.startFrame + splitFrameLocal,
              trimStart: splitTrim,
              trimEnd: t.trimEnd,
              eq: t.eq ? { ...t.eq } : null,
              volumeKeyframes: t.volumeKeyframes
                .filter((k) => k.frame >= splitFrameLocal)
                .map((k) => ({ ...k, frame: k.frame - splitFrameLocal })),
            };
            t.trimEnd = splitTrim;
            t.volumeKeyframes = t.volumeKeyframes.filter(
              (k) => k.frame < splitFrameLocal,
            );
            sc.audioTracks.splice(i + 1, 0, newTrack);
            return;
          }
        }),

      applyAnimationPresetToLayer: (layerId, preset, params) =>
        set((s) => {
          // Find the layer to build the context
          let targetLayer: (typeof s.project.scenes)[number]["layers"][number] | undefined;
          for (const sc of s.project.scenes) {
            const l = sc.layers.find((x) => x.id === layerId);
            if (l) {
              targetLayer = l;
              break;
            }
          }
          if (!targetLayer) return;

          // Build the context. anchorFrame=-1 is the sentinel for "compute default".
          const ctx = {
            layer: targetLayer,
            duration: params.duration,
            easing: params.easing,
            anchorFrame: params.anchorFrame ?? -1,
            values: params.values,
          };

          // Compute resolved anchor and clamped duration BEFORE entering mutator
          // so we can use them in the replace filter (closure capture).
          const layerLen = targetLayer.endFrame - targetLayer.startFrame;
          const clampedDuration = Math.min(params.duration, layerLen);
          const resolvedAnchor = resolveAnchor(preset, ctx, clampedDuration);

          // Build the new keyframes (with ids assigned by buildPresetKeyframes)
          const newKfs = buildPresetKeyframes(preset, ctx);

          mutateLayer(s, layerId, (l) => {
            if (params.replaceConflicts === true) {
              // Remove existing keyframes that conflict: same property AND
              // frame in [resolvedAnchor, resolvedAnchor + clampedDuration]
              l.keyframes = l.keyframes.filter(
                (k) =>
                  !(
                    preset.animatedProperties.includes(k.property) &&
                    k.frame >= resolvedAnchor &&
                    k.frame <= resolvedAnchor + clampedDuration
                  ),
              );
            }
            l.keyframes.push(...newKfs);
          });
        }),

      transcribeAudioTrack: async (trackId, opts) => {
        const state = get();
        const projectId = state.project.id;

        // Find sceneId for this trackId (search across scenes)
        let sceneId: string | null = null;
        for (const scene of state.project.scenes) {
          if (scene.audioTracks.some((t) => t.id === trackId)) {
            sceneId = scene.id;
            break;
          }
        }
        if (!sceneId) return;

        // Build query string
        const params = new URLSearchParams();
        if (opts?.model) params.set("model", opts.model);
        if (opts?.language) params.set("lang", opts.language);
        const qs = params.toString();

        // POST start
        const startUrl = `/api/projects/${projectId}/audioTracks/${trackId}/transcript${qs ? `?${qs}` : ""}`;
        const startRes = await fetch(startUrl, { method: "POST" });
        if (!startRes.ok) {
          set((s) => {
            s.transcriptionStatus[trackId] = {
              id: "",
              projectId,
              trackId,
              status: "error",
              progress: 0,
              error: `Start failed: ${startRes.status}`,
              startedAt: Date.now(),
              finishedAt: Date.now(),
            } as TranscriptJob;
          });
          return;
        }
        const { jobId } = (await startRes.json()) as { jobId: string };

        // Initial state
        set((s) => {
          s.transcriptionStatus[trackId] = {
            id: jobId,
            projectId,
            trackId,
            status: "queued",
            progress: 0,
            startedAt: Date.now(),
          } as TranscriptJob;
        });

        // Consume SSE
        const eventsRes = await fetch(
          `/api/projects/${projectId}/audioTracks/${trackId}/transcript/events?jobId=${jobId}`,
        );
        if (!eventsRes.body) return;
        const reader = eventsRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE: events separated by \n\n; each event has "data: <json>"
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const event = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataMatch = event.match(/^data:\s*(.+)$/m);
            if (!dataMatch) continue;
            let job: TranscriptJob;
            try {
              job = JSON.parse(dataMatch[1]!) as TranscriptJob;
            } catch {
              continue;
            }

            set((s) => {
              s.transcriptionStatus[trackId] = job;
            });

            if (job.status === "completed" && job.transcript) {
              // Default preset: subtitle-fade-segment
              get().createSubtitleLayerFromTranscript(
                sceneId!,
                trackId,
                job.transcript,
                "subtitle-fade-segment",
              );
              return; // stop consuming
            }
            if (job.status === "error") {
              return;
            }
          }
        }
      },
    })),
    {
      partialize: (state) =>
        ({ project: state.project }) as unknown as StoreState,
      limit: 100,
      equality: (a, b) => a.project === b.project,
    },
  ),
);

export const useTemporal = () => useEditorStore.temporal.getState();
