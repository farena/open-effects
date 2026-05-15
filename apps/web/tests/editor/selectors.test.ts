import { describe, it, expect } from "vitest";
import type { EditorState } from "@/editor/store.types";
import {
  selectActiveScene,
  selectActiveLayer,
  selectTotalDuration,
  selectAnimatedProperties,
  selectKeyframesForProperty,
  selectActiveAudioTrack,
  selectVolumeKeyframes,
  selectLocalFrameInActiveAudioTrack,
} from "@/editor/selectors";

// Minimal helpers to build fake state without React or the real store.
const makeState = (partial: Partial<EditorState> = {}): EditorState => ({
  project: {
    id: "p1",
    name: "Test",
    width: 1920,
    height: 1080,
    fps: 30,
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
  ...partial,
});

const makeScene = (
  id: string,
  durationFrames = 90,
  layers: EditorState["project"]["scenes"][number]["layers"] = [],
) => ({
  id,
  order: 0,
  name: `Scene ${id}`,
  background: "#000000",
  durationFrames,
  transitionIn: null,
  keyframes: [] as EditorState["project"]["scenes"][number]["keyframes"],
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
  visible: true,
  keyframes: [],
});

const makeAudioTrack = (
  id: string,
  volumeKeyframes: {
    frame: number;
    value: number;
    easingOut: { type: "linear" };
  }[] = [],
) => ({
  id,
  assetId: "asset-1",
  assetPath: "/audio.mp3",
  startFrame: 0,
  trimStart: 0,
  trimEnd: 100,
  muted: false,
  eq: null,
  volumeKeyframes,
});

// ── selectActiveScene ─────────────────────────────────────────────────────────

describe("selectActiveScene", () => {
  it("returns the scene matching selectedSceneId", () => {
    const scene = makeScene("scene-1");
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedSceneId: "scene-1",
    });
    expect(selectActiveScene(state)).toEqual(scene);
  });

  it("returns null when selectedSceneId is null", () => {
    const scene = makeScene("scene-1");
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedSceneId: null,
    });
    expect(selectActiveScene(state)).toBeNull();
  });

  it("returns null when selectedSceneId does not match any scene", () => {
    const scene = makeScene("scene-1");
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
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
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedLayerId: "layer-1",
    });
    expect(selectActiveLayer(state)).toEqual(layer);
  });

  it("finds a layer in the second scene when the first scene does not contain it", () => {
    const layer = makeLayer("layer-2");
    const scene1 = makeScene("scene-1", 90, [makeLayer("layer-1")]);
    const scene2 = makeScene("scene-2", 90, [layer]);
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene1, scene2],
      },
      selectedLayerId: "layer-2",
    });
    expect(selectActiveLayer(state)).toEqual(layer);
  });

  it("returns null when selectedLayerId does not match any layer", () => {
    const scene = makeScene("scene-1", 90, [makeLayer("layer-1")]);
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedLayerId: "layer-999",
    });
    expect(selectActiveLayer(state)).toBeNull();
  });

  it("returns null when selectedLayerId is null", () => {
    const scene = makeScene("scene-1", 90, [makeLayer("layer-1")]);
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
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
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
    });
    expect(selectTotalDuration(state)).toBe(120);
  });

  it("returns sum of all scene durations", () => {
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
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
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedLayerId: "layer-1",
    });
    expect(selectAnimatedProperties(state)).toEqual([]);
  });

  it("returns unique sorted list of properties from the active layer keyframes", () => {
    const layer = {
      ...makeLayer("layer-1"),
      keyframes: [
        {
          frame: 0,
          property: "transform.translateX",
          value: "0px",
          easingOut: { type: "linear" as const },
        },
        {
          frame: 15,
          property: "opacity",
          value: "0.5",
          easingOut: { type: "linear" as const },
        },
        {
          frame: 30,
          property: "transform.translateX",
          value: "100px",
          easingOut: { type: "linear" as const },
        },
        {
          frame: 30,
          property: "opacity",
          value: "1",
          easingOut: { type: "linear" as const },
        },
      ],
    };
    const scene = makeScene("scene-1", 90, [layer]);
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedLayerId: "layer-1",
    });
    expect(selectAnimatedProperties(state)).toEqual([
      "opacity",
      "transform.translateX",
    ]);
  });
});

// ── selectKeyframesForProperty ────────────────────────────────────────────────

describe("selectKeyframesForProperty", () => {
  it("returns [] when no active layer", () => {
    const state = makeState();
    expect(selectKeyframesForProperty("opacity")(state)).toEqual([]);
  });

  it("returns keyframes for the requested property sorted ascending by frame", () => {
    const kf1 = {
      frame: 30,
      property: "opacity",
      value: "1",
      easingOut: { type: "linear" as const },
    };
    const kf2 = {
      frame: 0,
      property: "opacity",
      value: "0",
      easingOut: { type: "linear" as const },
    };
    const kf3 = {
      frame: 15,
      property: "transform.translateX",
      value: "50px",
      easingOut: { type: "linear" as const },
    };
    const layer = { ...makeLayer("layer-1"), keyframes: [kf1, kf2, kf3] };
    const scene = makeScene("scene-1", 90, [layer]);
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedLayerId: "layer-1",
    });
    expect(selectKeyframesForProperty("opacity")(state)).toEqual([kf2, kf1]);
  });

  it("returns [] when the property has no keyframes on the active layer", () => {
    const layer = {
      ...makeLayer("layer-1"),
      keyframes: [
        {
          frame: 0,
          property: "opacity",
          value: "0",
          easingOut: { type: "linear" as const },
        },
      ],
    };
    const scene = makeScene("scene-1", 90, [layer]);
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedLayerId: "layer-1",
    });
    expect(selectKeyframesForProperty("transform.translateX")(state)).toEqual(
      [],
    );
  });
});

// ── selectActiveAudioTrack ────────────────────────────────────────────────────

describe("selectActiveAudioTrack", () => {
  it("returns null when selectedAudioTrackId is null", () => {
    const track = makeAudioTrack("track-1");
    const scene = {
      ...makeScene("scene-1"),
      audioTracks: [track],
    };
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedAudioTrackId: null,
    });
    expect(selectActiveAudioTrack(state)).toBeNull();
  });

  it("returns null when selectedAudioTrackId refers to a non-existent track", () => {
    const track = makeAudioTrack("track-1");
    const scene = {
      ...makeScene("scene-1"),
      audioTracks: [track],
    };
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedAudioTrackId: "track-999",
    });
    expect(selectActiveAudioTrack(state)).toBeNull();
  });

  it("returns the matching AudioTrack when id is valid", () => {
    const track = makeAudioTrack("track-1");
    const scene = {
      ...makeScene("scene-1"),
      audioTracks: [track],
    };
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedAudioTrackId: "track-1",
    });
    expect(selectActiveAudioTrack(state)).toEqual(track);
  });

  it("finds a track in the second scene when the first scene does not contain it", () => {
    const track = makeAudioTrack("track-2");
    const scene1 = {
      ...makeScene("scene-1"),
      audioTracks: [makeAudioTrack("track-1")],
    };
    const scene2 = {
      ...makeScene("scene-2"),
      audioTracks: [track],
    };
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene1, scene2],
      },
      selectedAudioTrackId: "track-2",
    });
    expect(selectActiveAudioTrack(state)).toEqual(track);
  });
});

// ── selectVolumeKeyframes ─────────────────────────────────────────────────────

describe("selectVolumeKeyframes", () => {
  it("returns empty array when no audio track is active", () => {
    const state = makeState({ selectedAudioTrackId: null });
    expect(selectVolumeKeyframes(state)).toEqual([]);
  });

  it("returns empty array when active track has no volume keyframes", () => {
    const track = makeAudioTrack("track-1");
    const scene = {
      ...makeScene("scene-1"),
      audioTracks: [track],
    };
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedAudioTrackId: "track-1",
    });
    expect(selectVolumeKeyframes(state)).toEqual([]);
  });

  it("returns the track's volumeKeyframes when a valid track is active", () => {
    const kf = { frame: 0, value: 0.8, easingOut: { type: "linear" as const } };
    const track = makeAudioTrack("track-1", [kf]);
    const scene = {
      ...makeScene("scene-1"),
      audioTracks: [track],
    };
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedAudioTrackId: "track-1",
    });
    expect(selectVolumeKeyframes(state)).toEqual([kf]);
  });
});

// ── selectLocalFrameInActiveAudioTrack ───────────────────────────────────────
//
// Regression: keyframes added via AudioFxTab on a track in scene ≥ 2 must
// account for the scene's global offset *and* the track's startFrame.

describe("selectLocalFrameInActiveAudioTrack", () => {
  it("returns 0 when no audio track is selected", () => {
    expect(selectLocalFrameInActiveAudioTrack(makeState())).toBe(0);
  });

  it("returns currentFrame - track.startFrame for a track in scene 1", () => {
    const track = { ...makeAudioTrack("track-1"), startFrame: 5 };
    const scene = { ...makeScene("scene-1", 90), audioTracks: [track] };
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene],
      },
      selectedAudioTrackId: "track-1",
      currentFrame: 20,
    });
    expect(selectLocalFrameInActiveAudioTrack(state)).toBe(15);
  });

  it("subtracts the scene offset for tracks in scenes ≥ 2", () => {
    const track = { ...makeAudioTrack("track-2"), startFrame: 10 };
    const scene1 = { ...makeScene("scene-1", 90) };
    const scene2 = {
      ...makeScene("scene-2", 90),
      order: 1,
      audioTracks: [track],
    };
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene1, scene2],
      },
      selectedAudioTrackId: "track-2",
      // Playhead at frame 130: scene 2 starts at 90, track starts at +10,
      // so the local frame on the track must be 30.
      currentFrame: 130,
    });
    expect(selectLocalFrameInActiveAudioTrack(state)).toBe(30);
  });

  it("clamps negative results to 0 when playhead precedes the track", () => {
    const track = { ...makeAudioTrack("track-2"), startFrame: 10 };
    const scene1 = { ...makeScene("scene-1", 90) };
    const scene2 = {
      ...makeScene("scene-2", 90),
      order: 1,
      audioTracks: [track],
    };
    const state = makeState({
      project: {
        id: "p1",
        name: "T",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: [scene1, scene2],
      },
      selectedAudioTrackId: "track-2",
      currentFrame: 50,
    });
    expect(selectLocalFrameInActiveAudioTrack(state)).toBe(0);
  });
});
