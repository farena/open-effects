import { describe, it, expect } from "vitest";
import type { EditorState } from "@/editor/store.types";
import {
  selectActiveScene,
  selectActiveLayer,
  selectTotalDuration,
  selectAnimatedProperties,
  selectKeyframesForProperty,
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

// ── selectAnimatedProperties ──────────────────────────────────────────────────

describe("selectAnimatedProperties", () => {
  it("returns [] when no active layer", () => {
    const state = makeState();
    expect(selectAnimatedProperties(state)).toEqual([]);
  });

  it("returns [] when active layer has no keyframes", () => {
    const layer = makeLayer("layer-1");
    const scene = makeScene("scene-1", 90, [layer]);
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
      selectedLayerId: "layer-1",
    });
    expect(selectAnimatedProperties(state)).toEqual([]);
  });

  it("returns unique sorted list of properties from the active layer keyframes", () => {
    const layer = {
      ...makeLayer("layer-1"),
      keyframes: [
        { frame: 0, property: "transform.translateX", value: "0px", easingOut: { type: "linear" as const } },
        { frame: 15, property: "opacity", value: "0.5", easingOut: { type: "linear" as const } },
        { frame: 30, property: "transform.translateX", value: "100px", easingOut: { type: "linear" as const } },
        { frame: 30, property: "opacity", value: "1", easingOut: { type: "linear" as const } },
      ],
    };
    const scene = makeScene("scene-1", 90, [layer]);
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
      selectedLayerId: "layer-1",
    });
    expect(selectAnimatedProperties(state)).toEqual(["opacity", "transform.translateX"]);
  });
});

// ── selectKeyframesForProperty ────────────────────────────────────────────────

describe("selectKeyframesForProperty", () => {
  it("returns [] when no active layer", () => {
    const state = makeState();
    expect(selectKeyframesForProperty("opacity")(state)).toEqual([]);
  });

  it("returns keyframes for the requested property sorted ascending by frame", () => {
    const kf1 = { frame: 30, property: "opacity", value: "1", easingOut: { type: "linear" as const } };
    const kf2 = { frame: 0, property: "opacity", value: "0", easingOut: { type: "linear" as const } };
    const kf3 = { frame: 15, property: "transform.translateX", value: "50px", easingOut: { type: "linear" as const } };
    const layer = { ...makeLayer("layer-1"), keyframes: [kf1, kf2, kf3] };
    const scene = makeScene("scene-1", 90, [layer]);
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
      selectedLayerId: "layer-1",
    });
    expect(selectKeyframesForProperty("opacity")(state)).toEqual([kf2, kf1]);
  });

  it("returns [] when the property has no keyframes on the active layer", () => {
    const layer = {
      ...makeLayer("layer-1"),
      keyframes: [
        { frame: 0, property: "opacity", value: "0", easingOut: { type: "linear" as const } },
      ],
    };
    const scene = makeScene("scene-1", 90, [layer]);
    const state = makeState({
      project: { id: "p1", name: "T", width: 1920, height: 1080, fps: 30, scenes: [scene] },
      selectedLayerId: "layer-1",
    });
    expect(selectKeyframesForProperty("transform.translateX")(state)).toEqual([]);
  });
});
