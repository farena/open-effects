import { describe, it, expect } from "vitest";
import type { EditorState } from "@/editor/store.types";
import {
  selectActiveScene,
  selectActiveLayer,
  selectTotalDuration,
} from "@/editor/selectors";

// Minimal helpers to build fake state without React or the real store.
const makeState = (partial: Partial<EditorState> = {}): EditorState => ({
  project: { id: "p1", name: "Test", width: 1920, height: 1080, fps: 30, scenes: [] },
  selectedSceneId: null,
  selectedLayerId: null,
  currentFrame: 0,
  isPlaying: false,
  saveStatus: "idle",
  lastSavedAt: null,
  ...partial,
});

const makeScene = (id: string, durationFrames = 90, layers: EditorState["project"]["scenes"][number]["layers"] = []) => ({
  id,
  order: 0,
  durationFrames,
  layers,
  audioTracks: [],
});

const makeLayer = (id: string) => ({
  id,
  order: 0,
  name: "Layer",
  html: "",
  css: "",
  startFrame: 0,
  endFrame: 90,
  keyframes: [],
});

// ── selectActiveScene ─────────────────────────────────────────────────────────

describe("selectActiveScene", () => {
  it("returns the scene matching selectedSceneId", () => {
    const scene = makeScene("scene-1");
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
      selectedSceneId: "scene-1",
    });
    expect(selectActiveScene(state)).toEqual(scene);
  });

  it("returns null when selectedSceneId is null", () => {
    const scene = makeScene("scene-1");
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
      selectedSceneId: null,
    });
    expect(selectActiveScene(state)).toBeNull();
  });

  it("returns null when selectedSceneId does not match any scene", () => {
    const scene = makeScene("scene-1");
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
      selectedSceneId: "scene-999",
    });
    expect(selectActiveScene(state)).toBeNull();
  });
});

// ── selectActiveLayer ─────────────────────────────────────────────────────────

describe("selectActiveLayer", () => {
  it("returns the layer matching selectedLayerId (searching across all scenes)", () => {
    const layer = makeLayer("layer-1");
    const scene = makeScene("scene-1", 90, [layer]);
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
      selectedLayerId: "layer-1",
    });
    expect(selectActiveLayer(state)).toEqual(layer);
  });

  it("finds a layer in the second scene when the first scene does not contain it", () => {
    const layer = makeLayer("layer-2");
    const scene1 = makeScene("scene-1", 90, [makeLayer("layer-1")]);
    const scene2 = makeScene("scene-2", 90, [layer]);
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene1, scene2] },
      selectedLayerId: "layer-2",
    });
    expect(selectActiveLayer(state)).toEqual(layer);
  });

  it("returns null when selectedLayerId does not match any layer", () => {
    const scene = makeScene("scene-1", 90, [makeLayer("layer-1")]);
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
      selectedLayerId: "layer-999",
    });
    expect(selectActiveLayer(state)).toBeNull();
  });

  it("returns null when selectedLayerId is null", () => {
    const scene = makeScene("scene-1", 90, [makeLayer("layer-1")]);
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
      selectedLayerId: null,
    });
    expect(selectActiveLayer(state)).toBeNull();
  });
});

// ── selectTotalDuration ───────────────────────────────────────────────────────

describe("selectTotalDuration", () => {
  it("returns 0 when there are no scenes", () => {
    const state = makeState();
    expect(selectTotalDuration(state)).toBe(0);
  });

  it("returns durationFrames of a single scene", () => {
    const scene = makeScene("scene-1", 120);
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
    });
    expect(selectTotalDuration(state)).toBe(120);
  });

  it("returns sum of all scene durations", () => {
    const state = makeState({
      project: {
        id: "p1", name: "T", width: 1920, height: 1080, fps: 30,
        scenes: [makeScene("s1", 90), makeScene("s2", 60), makeScene("s3", 30)],
      },
    });
    expect(selectTotalDuration(state)).toBe(180);
  });
});
