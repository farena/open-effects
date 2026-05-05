import type { EditorState } from "./store.types";

export const selectActiveScene = (s: EditorState) =>
  s.project.scenes.find((sc) => sc.id === s.selectedSceneId) ?? null;

export const selectActiveLayer = (s: EditorState) => {
  for (const sc of s.project.scenes) {
    const l = sc.layers.find((x) => x.id === s.selectedLayerId);
    if (l) return l;
  }
  return null;
};

export const selectTotalDuration = (s: EditorState) =>
  s.project.scenes.reduce((acc, sc) => acc + sc.durationFrames, 0);
