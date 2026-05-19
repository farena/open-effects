import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project, SubtitleLayer } from "@open-effects/shared-types";
import transcriptFixture from "../fixtures/transcript-3segments.json";

const SCENE_ID = "scene-override-1";
const TRACK_ID = "track-override-1";
const HTML_LAYER_ID = "html-layer-override-1";

const makeProject = (): Project => ({
  id: "proj-override",
  name: "Override Test Project",
  width: 1920,
  height: 1080,
  fps: 30,
  css: "",
  scenes: [
    {
      id: SCENE_ID,
      order: 0,
      name: "Scene 1",
      background: "#000000",
      durationFrames: 900,
      transitionIn: null,
      keyframes: [],
      layers: [
        {
          id: HTML_LAYER_ID,
          order: 0,
          name: "HTML Layer",
          html: "<div>initial html</div>",
          css: ".initial {}",
          startFrame: 0,
          endFrame: 900,
          visible: true,
          keyframes: [],
          type: "html",
        },
      ],
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

function getSubtitleLayer(layerId: string): SubtitleLayer {
  const state = useEditorStore.getState();
  for (const sc of state.project.scenes) {
    const l = sc.layers.find((x) => x.id === layerId);
    if (l && l.type === "subtitle") return l as SubtitleLayer;
  }
  throw new Error(`Subtitle layer ${layerId} not found`);
}

function getLayer(layerId: string) {
  const state = useEditorStore.getState();
  for (const sc of state.project.scenes) {
    const l = sc.layers.find((x) => x.id === layerId);
    if (l) return l;
  }
  throw new Error(`Layer ${layerId} not found`);
}

describe("manualOverride dirty flag", () => {
  let subtitleLayerId: string;

  beforeEach(() => {
    resetStore();
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );
    const state = useEditorStore.getState();
    const scene = state.project.scenes.find((s) => s.id === SCENE_ID)!;
    const subtitleLayer = scene.layers.find((l) => l.type === "subtitle")!;
    subtitleLayerId = subtitleLayer.id;

    // Ensure starts as false
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(false);
  });

  it("updateLayerHtml sets manualOverride=true on subtitle layer", () => {
    useEditorStore.getState().updateLayerHtml(subtitleLayerId, "<div>x</div>");
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(true);
  });

  it("updateLayerCss does NOT set manualOverride on subtitle layer (user CSS survives regeneration)", () => {
    useEditorStore.getState().updateLayerCss(subtitleLayerId, ".x{}");
    // l.css is the user's own style override and is preserved across preset
    // regeneration, so editing it must NOT flip manualOverride.
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(false);
  });

  it("updateSubtitlePresetCss sets manualOverride=true on subtitle layer", () => {
    useEditorStore
      .getState()
      .updateSubtitlePresetCss(subtitleLayerId, ".x{}");
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(true);
  });

  it("addKeyframe sets manualOverride=true on subtitle layer", () => {
    useEditorStore
      .getState()
      .addKeyframe(subtitleLayerId, "opacity", 10, "0.5", { type: "linear" });
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(true);
  });

  it("updateKeyframeValue sets manualOverride=true on subtitle layer", () => {
    // Seed a keyframe first via direct state mutation
    useEditorStore.setState((s) => {
      for (const sc of s.project.scenes) {
        const l = sc.layers.find((x) => x.id === subtitleLayerId);
        if (l) {
          l.keyframes.push({
            id: "kf-seed-1",
            property: "opacity",
            frame: 5,
            value: "0.3",
            easingOut: { type: "linear" },
          });
          // Reset manualOverride to false for the test
          if (l.type === "subtitle") l.subtitle.manualOverride = false;
          break;
        }
      }
    });

    useEditorStore
      .getState()
      .updateKeyframeValue(subtitleLayerId, "opacity", 5, "0.8");
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(true);
  });

  it("deleteKeyframe sets manualOverride=true on subtitle layer", () => {
    // Seed a keyframe first
    useEditorStore.setState((s) => {
      for (const sc of s.project.scenes) {
        const l = sc.layers.find((x) => x.id === subtitleLayerId);
        if (l) {
          l.keyframes.push({
            id: "kf-seed-2",
            property: "opacity",
            frame: 15,
            value: "1",
            easingOut: { type: "linear" },
          });
          if (l.type === "subtitle") l.subtitle.manualOverride = false;
          break;
        }
      }
    });

    useEditorStore
      .getState()
      .deleteKeyframe(subtitleLayerId, "opacity", 15);
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(true);
  });

  it("moveKeyframe sets manualOverride=true on subtitle layer", () => {
    useEditorStore.setState((s) => {
      for (const sc of s.project.scenes) {
        const l = sc.layers.find((x) => x.id === subtitleLayerId);
        if (l) {
          l.keyframes.push({
            id: "kf-seed-move",
            property: "opacity",
            frame: 20,
            value: "0.5",
            easingOut: { type: "linear" },
          });
          if (l.type === "subtitle") l.subtitle.manualOverride = false;
          break;
        }
      }
    });

    useEditorStore
      .getState()
      .moveKeyframe(subtitleLayerId, "opacity", 20, 25);
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(true);
  });

  it("updateKeyframeEasing sets manualOverride=true on subtitle layer", () => {
    useEditorStore.setState((s) => {
      for (const sc of s.project.scenes) {
        const l = sc.layers.find((x) => x.id === subtitleLayerId);
        if (l) {
          l.keyframes.push({
            id: "kf-seed-easing",
            property: "opacity",
            frame: 30,
            value: "1",
            easingOut: { type: "linear" },
          });
          if (l.type === "subtitle") l.subtitle.manualOverride = false;
          break;
        }
      }
    });

    useEditorStore
      .getState()
      .updateKeyframeEasing(subtitleLayerId, "opacity", 30, { type: "ease-in-out" });
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(true);
  });

  it("updateLayerHtml on html layer does NOT set manualOverride (layer has no subtitle)", () => {
    // updateLayerHtml on an html-type layer should not throw or add manualOverride
    expect(() => {
      useEditorStore
        .getState()
        .updateLayerHtml(HTML_LAYER_ID, "<div>changed</div>");
    }).not.toThrow();

    const layer = getLayer(HTML_LAYER_ID);
    // html layers have no .subtitle property
    expect(layer.type).toBe("html");
    expect((layer as any).subtitle).toBeUndefined();
  });

  it("addKeyframe on html layer does NOT set manualOverride (layer has no subtitle)", () => {
    expect(() => {
      useEditorStore
        .getState()
        .addKeyframe(HTML_LAYER_ID, "opacity", 10, "0.5", { type: "linear" });
    }).not.toThrow();

    const layer = getLayer(HTML_LAYER_ID);
    expect(layer.type).toBe("html");
    expect((layer as any).subtitle).toBeUndefined();
  });

  it("deleteKeyframe on html layer does NOT throw and has no subtitle", () => {
    // Seed a keyframe on the html layer
    useEditorStore.setState((s) => {
      for (const sc of s.project.scenes) {
        const l = sc.layers.find((x) => x.id === HTML_LAYER_ID);
        if (l) {
          l.keyframes.push({
            id: "kf-html-1",
            property: "opacity",
            frame: 5,
            value: "0",
            easingOut: { type: "linear" },
          });
          break;
        }
      }
    });

    expect(() => {
      useEditorStore
        .getState()
        .deleteKeyframe(HTML_LAYER_ID, "opacity", 5);
    }).not.toThrow();

    const layer = getLayer(HTML_LAYER_ID);
    expect(layer.type).toBe("html");
    expect((layer as any).subtitle).toBeUndefined();
  });
});

describe("setSubtitleManualOverride", () => {
  let subtitleLayerId: string;

  beforeEach(() => {
    resetStore();
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );
    const state = useEditorStore.getState();
    const scene = state.project.scenes.find((s) => s.id === SCENE_ID)!;
    subtitleLayerId = scene.layers.find((l) => l.type === "subtitle")!.id;

    // Set the flag to true first
    useEditorStore.getState().updateLayerHtml(subtitleLayerId, "<div>edited</div>");
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(true);
  });

  it("setSubtitleManualOverride(layerId, false) clears the flag", () => {
    useEditorStore.getState().setSubtitleManualOverride(subtitleLayerId, false);
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(false);
  });

  it("setSubtitleManualOverride(layerId, true) sets the flag", () => {
    useEditorStore.getState().setSubtitleManualOverride(subtitleLayerId, false);
    useEditorStore.getState().setSubtitleManualOverride(subtitleLayerId, true);
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(true);
  });
});

describe("setSubtitlePreset", () => {
  let subtitleLayerId: string;
  let initialHtml: string;

  beforeEach(() => {
    resetStore();
    useEditorStore
      .getState()
      .createSubtitleLayerFromTranscript(
        SCENE_ID,
        TRACK_ID,
        transcriptFixture,
        "subtitle-fade",
      );
    const state = useEditorStore.getState();
    const scene = state.project.scenes.find((s) => s.id === SCENE_ID)!;
    subtitleLayerId = scene.layers.find((l) => l.type === "subtitle")!.id;
    initialHtml = getSubtitleLayer(subtitleLayerId).html;
  });

  it("setSubtitlePreset updates subtitle.presetKey", () => {
    useEditorStore
      .getState()
      .setSubtitlePreset(subtitleLayerId, "subtitle-pop-up");
    expect(getSubtitleLayer(subtitleLayerId).subtitle.presetKey).toBe(
      "subtitle-pop-up",
    );
  });

  it("setSubtitlePreset rebuilds html (still well-formed subtitle markup)", () => {
    useEditorStore
      .getState()
      .setSubtitlePreset(subtitleLayerId, "subtitle-pop-up");
    const layer = getSubtitleLayer(subtitleLayerId);
    expect(layer.html).toContain("subtitle-container");
    expect(layer.html).toContain("subtitle-segment");
    // All presets are segment-level and share the same HTML structure now —
    // what changes between presets is the preset CSS, not the markup. So
    // the html doesn't have to differ; the contract is just "still valid".
  });

  it("setSubtitlePreset regenerates presetCss (each preset has its own @keyframes — without this the animation stays on the previous preset)", () => {
    const fadeCss = getSubtitleLayer(subtitleLayerId).subtitle.presetCss;
    // Fade preset emits subtitle-show-*, not subtitle-slide-show-*
    expect(fadeCss).toContain("@keyframes subtitle-show-0");
    expect(fadeCss).not.toContain("@keyframes subtitle-slide-show-0");

    useEditorStore
      .getState()
      .setSubtitlePreset(subtitleLayerId, "subtitle-slide");
    const slideCss = getSubtitleLayer(subtitleLayerId).subtitle.presetCss;
    expect(slideCss).toContain("@keyframes subtitle-slide-show-0");
    expect(slideCss).not.toContain("@keyframes subtitle-show-0");

    useEditorStore
      .getState()
      .setSubtitlePreset(subtitleLayerId, "subtitle-pop-up");
    const popUpCss = getSubtitleLayer(subtitleLayerId).subtitle.presetCss;
    // Pop-up emits per-segment pop-in/out keyframes — not the slide ones
    expect(popUpCss).toContain("@keyframes subtitle-pop-in-0");
    expect(popUpCss).toContain("@keyframes subtitle-pop-out-0");
    expect(popUpCss).not.toContain("@keyframes subtitle-slide-show-0");
  });

  it("setSubtitlePreset preserves user css (layer.css) across preset changes", () => {
    useEditorStore
      .getState()
      .updateLayerCss(subtitleLayerId, ".subtitle-container { color: red; }");

    useEditorStore
      .getState()
      .setSubtitlePreset(subtitleLayerId, "subtitle-slide");

    expect(getSubtitleLayer(subtitleLayerId).css).toBe(
      ".subtitle-container { color: red; }",
    );
  });

  it("setSubtitlePreset resets manualOverride to false", () => {
    // First set a manual override
    useEditorStore.getState().updateLayerHtml(subtitleLayerId, "<div>manual</div>");
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(true);

    useEditorStore
      .getState()
      .setSubtitlePreset(subtitleLayerId, "subtitle-pop-up");
    expect(getSubtitleLayer(subtitleLayerId).subtitle.manualOverride).toBe(false);
  });

  it("setSubtitlePreset recomputes endFrame from transcript", () => {
    useEditorStore
      .getState()
      .setSubtitlePreset(subtitleLayerId, "subtitle-pop-up");
    const layer = getSubtitleLayer(subtitleLayerId);
    // Last segment endFrame in fixture is 310
    expect(layer.endFrame).toBe(310);
  });

  it("setSubtitlePreset on html layer is a no-op (no exception)", () => {
    expect(() => {
      useEditorStore
        .getState()
        .setSubtitlePreset(HTML_LAYER_ID, "subtitle-pop-up");
    }).not.toThrow();

    const layer = getLayer(HTML_LAYER_ID);
    expect(layer.type).toBe("html");
  });
});
