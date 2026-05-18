import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project, SubtitleLayer } from "@open-effects/shared-types";
import transcriptFixture from "../fixtures/transcript-3segments.json";

const SCENE_ID = "scene-regen-1";
const TRACK_ID = "track-regen-1";

const makeProject = (): Project => ({
  id: "proj-regen",
  name: "Regen Test Project",
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
  css: "",
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

function getSubtitleLayer(layerId: string): SubtitleLayer {
  const state = useEditorStore.getState();
  for (const sc of state.project.scenes) {
    const l = sc.layers.find((x) => x.id === layerId);
    if (l && l.type === "subtitle") return l as SubtitleLayer;
  }
  throw new Error(`Subtitle layer ${layerId} not found`);
}

describe("updateSubtitleTranscript and regenerateSubtitleLayer", () => {
  let layerId: string;

  beforeEach(() => {
    resetStore();
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade-segment",
      );
    const state = useEditorStore.getState();
    const scene = state.project.scenes.find((s) => s.id === SCENE_ID)!;
    layerId = scene.layers[0]!.id;
  });

  it("updateSubtitleTranscript updates transcript without regenerating html/css/keyframes", () => {
    const initialLayer = getSubtitleLayer(layerId);
    const initialHtml = initialLayer.html;
    const initialCss = initialLayer.css;
    const initialKeyframes = initialLayer.keyframes;

    const nextTranscript = {
      ...transcriptFixture,
      segments: transcriptFixture.segments.map((seg, i) =>
        i === 0
          ? { ...seg, text: "Hola modificado." }
          : seg,
      ),
    };

    useEditorStore.getState().updateSubtitleTranscript(layerId, nextTranscript);

    const layer = getSubtitleLayer(layerId);
    expect(layer.subtitle.transcript.segments[0]!.text).toBe("Hola modificado.");
    expect(layer.html).toBe(initialHtml);
    expect(layer.css).toBe(initialCss);
    expect(layer.keyframes).toBe(initialKeyframes);
    expect(layer.subtitle.manualOverride).toBe(false);
  });

  it("updateSubtitleTranscript does NOT change endFrame", () => {
    const initialLayer = getSubtitleLayer(layerId);
    const initialEndFrame = initialLayer.endFrame;

    // Build a transcript whose last segment endFrame is different (e.g. 500)
    const nextTranscript = {
      ...transcriptFixture,
      segments: transcriptFixture.segments.map((seg, i) =>
        i === transcriptFixture.segments.length - 1
          ? { ...seg, endFrame: 500 }
          : seg,
      ),
    };

    useEditorStore.getState().updateSubtitleTranscript(layerId, nextTranscript);

    const layer = getSubtitleLayer(layerId);
    expect(layer.endFrame).toBe(initialEndFrame);
  });

  it("regenerateSubtitleLayer regenerates html + keyframes but preserves css", () => {
    // First, manually override html and css to simulate manual edits
    useEditorStore.setState((s) => {
      for (const sc of s.project.scenes) {
        const l = sc.layers.find((x) => x.id === layerId);
        if (l && l.type === "subtitle") {
          l.html = "<div>manual</div>";
          l.css = ".custom { color: red; }";
          l.subtitle.manualOverride = true;
          break;
        }
      }
    });

    useEditorStore.getState().regenerateSubtitleLayer(layerId);

    const layer = getSubtitleLayer(layerId);
    // html should be regenerated (not the manual override)
    expect(layer.html).not.toBe("<div>manual</div>");
    // html should contain expected subtitle structure
    expect(layer.html).toContain("subtitle-container");
    expect(layer.html).toMatch(/subtitle-segment/);
    // css MUST be preserved
    expect(layer.css).toBe(".custom { color: red; }");
    // manualOverride reset
    expect(layer.subtitle.manualOverride).toBe(false);
  });

  it("regenerateSubtitleLayer recomputes endFrame from transcript", () => {
    useEditorStore.getState().regenerateSubtitleLayer(layerId);

    const layer = getSubtitleLayer(layerId);
    expect(layer.endFrame).toBe(310);
  });

  it("regenerateSubtitleLayer after updateSubtitleTranscript uses updated transcript's endFrame", () => {
    const nextTranscript = {
      ...transcriptFixture,
      segments: transcriptFixture.segments.map((seg, i) =>
        i === transcriptFixture.segments.length - 1
          ? { ...seg, endFrame: 500 }
          : seg,
      ),
    };
    useEditorStore.getState().updateSubtitleTranscript(layerId, nextTranscript);
    useEditorStore.getState().regenerateSubtitleLayer(layerId);

    const layer = getSubtitleLayer(layerId);
    expect(layer.endFrame).toBe(500);
  });

  it("regenerateSubtitleLayer is a no-op for html layers", () => {
    // Add a plain html layer
    useEditorStore.getState().addLayer(SCENE_ID);
    const state = useEditorStore.getState();
    const scene = state.project.scenes.find((s) => s.id === SCENE_ID)!;
    const htmlLayer = scene.layers.find((l) => l.type !== "subtitle")!;
    const htmlLayerId = htmlLayer.id;
    const snapshotHtml = htmlLayer.html;

    expect(() => {
      useEditorStore.getState().regenerateSubtitleLayer(htmlLayerId);
    }).not.toThrow();

    const afterLayer = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!
      .layers.find((l) => l.id === htmlLayerId)!;
    expect(afterLayer.html).toBe(snapshotHtml);
  });

  it("updateSubtitleTranscript is a no-op for html layers", () => {
    useEditorStore.getState().addLayer(SCENE_ID);
    const state = useEditorStore.getState();
    const scene = state.project.scenes.find((s) => s.id === SCENE_ID)!;
    const htmlLayer = scene.layers.find((l) => l.type !== "subtitle")!;
    const htmlLayerId = htmlLayer.id;
    const snapshotHtml = htmlLayer.html;

    expect(() => {
      useEditorStore
        .getState()
        .updateSubtitleTranscript(htmlLayerId, transcriptFixture);
    }).not.toThrow();

    const afterLayer = useEditorStore
      .getState()
      .project.scenes.find((s) => s.id === SCENE_ID)!
      .layers.find((l) => l.id === htmlLayerId)!;
    expect(afterLayer.html).toBe(snapshotHtml);
  });
});
