import type { Scene } from "@open-effects/shared-types";
import type { EditorState } from "./store.types";

function sortedScenes(s: EditorState) {
  return [...s.project.scenes].sort((a, b) => a.order - b.order);
}

/**
 * Frames that scene `i` (i ≥ 1) eats from the preceding scene's tail because
 * of its incoming transition. The first scene cannot have an incoming overlap.
 */
function sceneTransitionOverlap(sc: Scene, index: number): number {
  if (index === 0) return 0;
  const t = sc.transitionIn;
  if (!t || t.type === "none") return 0;
  return t.durationFrames;
}

export function sceneGlobalStartFrame(s: EditorState, sceneId: string): number {
  let acc = 0;
  const sorted = sortedScenes(s);
  for (let i = 0; i < sorted.length; i++) {
    const sc = sorted[i]!;
    acc -= sceneTransitionOverlap(sc, i);
    if (sc.id === sceneId) return acc;
    acc += sc.durationFrames;
  }
  return 0;
}

/** Playhead position in local scene frames (for the active scene). */
export const selectLocalFrameInActiveScene = (s: EditorState): number => {
  const sc = selectActiveScene(s);
  if (!sc) return 0;
  const start = sceneGlobalStartFrame(s, sc.id);
  const local = s.currentFrame - start;
  const max = Math.max(0, sc.durationFrames - 1);
  return Math.max(0, Math.min(max, local));
};

/** Playhead in local layer timeline when a layer is active. */
export const selectLocalFrameInActiveLayer = (s: EditorState): number => {
  const layer = selectActiveLayer(s);
  if (!layer) return 0;
  const sc = s.project.scenes.find((x) =>
    x.layers.some((l) => l.id === layer.id),
  );
  if (!sc) return 0;
  const start = sceneGlobalStartFrame(s, sc.id);
  const local = s.currentFrame - start - layer.startFrame;
  const span = Math.max(1, layer.endFrame - layer.startFrame);
  return Math.max(0, Math.min(span - 1, local));
};

export const selectActiveScene = (s: EditorState) =>
  s.project.scenes.find((sc) => sc.id === s.selectedSceneId) ?? null;

/**
 * Returns the id of the scene that contains the current playhead frame. Walks
 * scenes in order, subtracting transitionIn overlaps so the math matches the
 * timeline layout. Falls back to the last scene if the playhead sits past the
 * composition end, and returns null only when there are no scenes.
 */
export const selectSceneIdAtCurrentFrame = (s: EditorState): string | null => {
  const sorted = sortedScenes(s);
  if (sorted.length === 0) return null;
  let acc = 0;
  for (let i = 0; i < sorted.length; i++) {
    const sc = sorted[i]!;
    acc -= sceneTransitionOverlap(sc, i);
    const end = acc + sc.durationFrames;
    if (s.currentFrame < end) return sc.id;
    acc = end;
  }
  return sorted[sorted.length - 1]!.id;
};

export const selectAudioTracksForScene =
  (sceneId: string) => (s: EditorState) =>
    s.project.scenes.find((sc) => sc.id === sceneId)?.audioTracks ?? [];

export const selectActiveAudioTrack = (s: EditorState) => {
  if (!s.selectedAudioTrackId) return null;
  for (const sc of s.project.scenes) {
    const t = sc.audioTracks.find((x) => x.id === s.selectedAudioTrackId);
    if (t) return t;
  }
  return null;
};

export const selectActiveAudioTrackSceneId = (s: EditorState): string | null => {
  if (!s.selectedAudioTrackId) return null;
  for (const sc of s.project.scenes) {
    if (sc.audioTracks.some((x) => x.id === s.selectedAudioTrackId)) return sc.id;
  }
  return null;
};

export const selectVolumeKeyframes = (s: EditorState) =>
  selectActiveAudioTrack(s)?.volumeKeyframes ?? [];

/** Playhead in local audio-track frames when an audio track is active. */
export const selectLocalFrameInActiveAudioTrack = (s: EditorState): number => {
  if (!s.selectedAudioTrackId) return 0;
  for (const sc of s.project.scenes) {
    const t = sc.audioTracks.find((x) => x.id === s.selectedAudioTrackId);
    if (!t) continue;
    const start = sceneGlobalStartFrame(s, sc.id);
    return Math.max(0, s.currentFrame - start - t.startFrame);
  }
  return 0;
};

export const selectActiveLayer = (s: EditorState) => {
  for (const sc of s.project.scenes) {
    const l = sc.layers.find((x) => x.id === s.selectedLayerId);
    if (l) return l;
  }
  return null;
};

export const selectTotalDuration = (s: EditorState) => {
  const sorted = sortedScenes(s);
  return sorted.reduce(
    (acc, sc, i) => acc + sc.durationFrames - sceneTransitionOverlap(sc, i),
    0,
  );
};

export const selectAnimatedProperties = (s: EditorState): string[] => {
  const l = selectActiveLayer(s);
  if (!l) return [];
  return Array.from(new Set(l.keyframes.map((k) => k.property))).sort();
};

/** Animated properties on the active scene (when no layer is selected). */
export const selectAnimatedSceneProperties = (s: EditorState): string[] => {
  if (s.selectedLayerId !== null) return [];
  const sc = selectActiveScene(s);
  if (!sc) return [];
  return Array.from(new Set(sc.keyframes.map((k) => k.property))).sort();
};

export const selectKeyframesForProperty =
  (property: string) => (s: EditorState) => {
    const l = selectActiveLayer(s);
    if (!l) return [];
    return l.keyframes
      .filter((k) => k.property === property)
      .sort((a, b) => a.frame - b.frame);
  };

export const selectSceneKeyframesForProperty =
  (property: string) => (s: EditorState) => {
    if (s.selectedLayerId !== null) return [];
    const sc = selectActiveScene(s);
    if (!sc) return [];
    return sc.keyframes
      .filter((k) => k.property === property)
      .sort((a, b) => a.frame - b.frame);
  };

export const selectKeyframesForPropertyOnScene =
  (sceneId: string, property: string) => (s: EditorState) => {
    const sc = s.project.scenes.find((x) => x.id === sceneId);
    if (!sc) return [];
    return sc.keyframes
      .filter((k) => k.property === property)
      .sort((a, b) => a.frame - b.frame);
  };

/**
 * Returns the set of audio property keys that already have keyframes on the
 * active track. For v1 this is just `["volume"]` if volumeKeyframes is non-
 * empty. Designed so future props (pan/pitch) plug in by extending this list.
 */
export const selectAudioAnimatedProperties = (
  s: EditorState,
): Array<"volume"> => {
  const track = selectActiveAudioTrack(s);
  if (!track) return [];
  const animated: Array<"volume"> = [];
  if (track.volumeKeyframes.length > 0) animated.push("volume");
  return animated;
};
