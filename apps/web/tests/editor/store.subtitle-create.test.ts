import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project } from "@open-effects/shared-types";
import transcriptFixture from "../fixtures/transcript-3segments.json";

const SCENE_ID = "scene-subtitle-1";
const TRACK_ID = "track-subtitle-1";

const makeProject = (): Project => ({
  id: "proj-subtitle",
  name: "Subtitle Test Project",
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [
    {
      id: SCENE_ID,
      order: 0,
      name: "Scene 1",
      background: "#000000",
      durationFrames: 900,
      transitionIn: null,
      keyframes: [],
      layers: [],
      audioTracks: [
        {
          id: TRACK_ID,
          assetId: "asset-1",
          assetPath: "/uploads/test.mp3",
          startFrame: 0,
          trimStart: 0,
          trimEnd: 900,
          muted: false,
          eq: null,
          volumeKeyframes: [],
        },
      ],
    },
  ],
});

function resetStore() {
  useEditorStore.setState({
    project: makeProject(),
    selectedSceneId: SCENE_ID,
    selectedLayerId: null,
    selectedAudioTrackId: null,
    currentFrame: 0,
    isPlaying: false,
    saveStatus: "idle",
    lastSavedAt: null,
  });
}

describe("createSubtitleLayerFromTranscript", () => {
  beforeEach(() => {
    resetStore();
  });

  it("adds exactly one layer to the scene", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    expect(scene.layers).toHaveLength(1);
  });

  it("layer has type 'subtitle'", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    const layer = scene.layers[0]!;
    expect(layer.type).toBe("subtitle");
  });

  it("layer subtitle.linkedAudioTrackId matches trackId", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    const layer = scene.layers[0]!;
    expect(layer.type).toBe("subtitle");
    if (layer.type === "subtitle") {
      expect(layer.subtitle.linkedAudioTrackId).toBe(TRACK_ID);
    }
  });

  it("layer subtitle.presetKey matches the requested preset", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    const layer = scene.layers[0]!;
    if (layer.type === "subtitle") {
      expect(layer.subtitle.presetKey).toBe("subtitle-fade");
    }
  });

  it("layer subtitle.manualOverride is false", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    const layer = scene.layers[0]!;
    if (layer.type === "subtitle") {
      expect(layer.subtitle.manualOverride).toBe(false);
    }
  });

  it("layer subtitle.transcript deep-equals the fixture", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    const layer = scene.layers[0]!;
    if (layer.type === "subtitle") {
      expect(layer.subtitle.transcript).toEqual(transcriptFixture);
    }
  });

  it("layer html is non-empty", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    const layer = scene.layers[0]!;
    expect(layer.html.length).toBeGreaterThan(0);
  });

  it("layer.css starts empty (user CSS) and subtitle.presetCss is generated", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    const layer = scene.layers[0]!;
    expect(layer.css).toBe("");
    if (layer.type === "subtitle") {
      expect(layer.subtitle.presetCss.length).toBeGreaterThan(0);
      expect(layer.subtitle.presetCss).toContain(".subtitle-container");
    }
  });

  it("layer keyframes is empty (v1 CSS-only)", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    const layer = scene.layers[0]!;
    expect(layer.keyframes).toHaveLength(0);
  });

  it("layer endFrame equals 310 (last segment endFrame from fixture)", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    const layer = scene.layers[0]!;
    expect(layer.endFrame).toBe(310);
  });

  it("selectedLayerId is updated to the new layer id", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    const layer = scene.layers[0]!;
    const { selectedLayerId } = useEditorStore.getState();
    expect(selectedLayerId).toBe(layer.id);
  });

  it("does nothing when sceneId is not found", () => {
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        "nonexistent-scene",
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );

    const scene = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!;
    expect(scene.layers).toHaveLength(0);
  });

  it("throws for an unknown preset key", () => {
    expect(() => {
      useEditorStore
        .getState()
        .createSubtitleLayerFromTranscript(
          SCENE_ID,
          TRACK_ID,
          transcriptFixture,
          "nonexistent-preset",
        );
    }).toThrow();
  });
});
