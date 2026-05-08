import type { EditorState } from "./store.types";

function sortedScenes(s: EditorState) {
  return [...s.project.scenes].sort((a, b) => a.order - b.order);
}

export function sceneGlobalStartFrame(s: EditorState, sceneId: string): number {
  let acc = 0;
  for (const sc of sortedScenes(s)) {
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

export const selectVolumeKeyframes = (s: EditorState) =>
  selectActiveAudioTrack(s)?.volumeKeyframes ?? [];

export const selectActiveLayer = (s: EditorState) => {
  for (const sc of s.project.scenes) {
    const l = sc.layers.find((x) => x.id === s.selectedLayerId);
    if (l) return l;
  }
  return null;
};

export const selectTotalDuration = (s: EditorState) =>
  s.project.scenes.reduce((acc, sc) => acc + sc.durationFrames, 0);

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
