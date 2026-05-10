import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project } from "@open-effects/shared-types";
import type { AnimationPreset } from "@/editor/presets/types";
import { newId } from "@/lib/ids";

const LAYER_ID = "layer-1";
const SCENE_ID = "scene-1";

// Minimal fade-in preset for testing
const fadeInPreset: AnimationPreset = {
  key: "fade-in",
  name: "Fade In",
  category: "in",
  iconKey: "fade",
  defaultDuration: 30,
  defaultEasing: { type: "ease-out" },
  params: [
    { kind: "number", key: "fromOpacity", label: "From", default: 0, min: 0, max: 1 },
    { kind: "number", key: "toOpacity", label: "To", default: 1, min: 0, max: 1 },
  ],
  animatedProperties: ["opacity"],
  build: (ctx) => [
    { frame: ctx.anchorFrame, property: "opacity", value: String(ctx.values.fromOpacity ?? 0), easingOut: ctx.easing },
    { frame: ctx.anchorFrame + ctx.duration, property: "opacity", value: String(ctx.values.toOpacity ?? 1), easingOut: ctx.easing },
  ],
};

const makeProject = (): Project => ({
  id: "proj-1",
  name: "Test Project",
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [
    {
      id: SCENE_ID,
      order: 0,
      name: "Scene 1",
      background: "#000000",
      durationFrames: 120,
      transitionIn: null,
      keyframes: [],
      audioTracks: [],
      layers: [
        {
          id: LAYER_ID,
          order: 0,
          name: "Layer 1",
          html: "",
          css: "",
          startFrame: 0,
          endFrame: 120,
          visible: true,
          keyframes: [],
        },
      ],
    },
  ],
});

function resetStore() {
  useEditorStore.setState({
    project: makeProject(),
    selectedSceneId: SCENE_ID,
    selectedLayerId: LAYER_ID,
    currentFrame: 0,
    isPlaying: false,
    saveStatus: "idle",
    lastSavedAt: null,
    selectedAudioTrackId: null,
  });
  useEditorStore.temporal.getState().clear();
}

function getLayer() {
  return useEditorStore
    .getState()
    .project.scenes[0]!.layers.find((l) => l.id === LAYER_ID)!;
}

describe("applyAnimationPresetToLayer — happy path", () => {
  beforeEach(() => {
    resetStore();
  });

  it("adds two opacity keyframes at frames [0, 30]", () => {
    useEditorStore.getState().applyAnimationPresetToLayer(LAYER_ID, fadeInPreset, {
      duration: 30,
      easing: { type: "linear" },
      values: { fromOpacity: 0, toOpacity: 1 },
    });

    const kfs = getLayer().keyframes;
    expect(kfs).toHaveLength(2);
    expect(kfs.every((k) => k.property === "opacity")).toBe(true);
    const frames = kfs.map((k) => k.frame).sort((a, b) => a - b);
    expect(frames).toEqual([0, 30]);
  });

  it("all generated keyframes have ids", () => {
    useEditorStore.getState().applyAnimationPresetToLayer(LAYER_ID, fadeInPreset, {
      duration: 30,
      easing: { type: "linear" },
      values: { fromOpacity: 0, toOpacity: 1 },
    });

    const kfs = getLayer().keyframes;
    expect(kfs.every((k) => typeof k.id === "string" && k.id.length > 0)).toBe(true);
  });

  it("the action is undoable — undo restores keyframes.length === 0", () => {
    useEditorStore.getState().applyAnimationPresetToLayer(LAYER_ID, fadeInPreset, {
      duration: 30,
      easing: { type: "linear" },
      values: { fromOpacity: 0, toOpacity: 1 },
    });

    expect(getLayer().keyframes).toHaveLength(2);

    useEditorStore.temporal.getState().undo();

    expect(getLayer().keyframes).toHaveLength(0);
  });

  it("pastStates length increases by 1 after apply", () => {
    const before = useEditorStore.temporal.getState().pastStates.length;
    useEditorStore.getState().applyAnimationPresetToLayer(LAYER_ID, fadeInPreset, {
      duration: 30,
      easing: { type: "linear" },
      values: { fromOpacity: 0, toOpacity: 1 },
    });
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(before + 1);
  });
});

describe("applyAnimationPresetToLayer — collision / replace branch", () => {
  function makeProjectWithExistingKeyframe(): Project {
    const base = makeProject();
    base.scenes[0]!.layers[0]!.keyframes = [
      {
        id: newId(),
        frame: 15,
        property: "opacity",
        value: "0.5",
        easingOut: { type: "linear" },
      },
    ];
    return base;
  }

  beforeEach(() => {
    useEditorStore.setState({
      project: makeProjectWithExistingKeyframe(),
      selectedSceneId: SCENE_ID,
      selectedLayerId: LAYER_ID,
      currentFrame: 0,
      isPlaying: false,
      saveStatus: "idle",
      lastSavedAt: null,
      selectedAudioTrackId: null,
    });
    useEditorStore.temporal.getState().clear();
  });

  it("replaceConflicts: false — keeps existing keyframe and adds 2 new → 3 total", () => {
    useEditorStore.getState().applyAnimationPresetToLayer(LAYER_ID, fadeInPreset, {
      duration: 30,
      easing: { type: "linear" },
      values: { fromOpacity: 0, toOpacity: 1 },
      replaceConflicts: false,
    });

    expect(getLayer().keyframes).toHaveLength(3);
  });

  it("replaceConflicts: true — removes conflicting keyframe and adds 2 new → 2 total", () => {
    useEditorStore.getState().applyAnimationPresetToLayer(LAYER_ID, fadeInPreset, {
      duration: 30,
      easing: { type: "linear" },
      values: { fromOpacity: 0, toOpacity: 1 },
      replaceConflicts: true,
    });

    const kfs = getLayer().keyframes;
    expect(kfs).toHaveLength(2);
    // Existing keyframe at frame 15 should be gone
    expect(kfs.find((k) => k.frame === 15)).toBeUndefined();
  });

  it("replaceConflicts: true — preserves opacity keyframe OUTSIDE [0, 30] range", () => {
    // Add an opacity keyframe at frame 60 (outside the fade-in range [0,30])
    useEditorStore.getState().applyAnimationPresetToLayer(LAYER_ID, fadeInPreset, {
      duration: 30,
      easing: { type: "linear" },
      values: { fromOpacity: 0, toOpacity: 1 },
      replaceConflicts: true,
    });

    // After apply we have 2 keyframes at [0, 30]. Now add one at frame 60 and re-apply.
    useEditorStore.temporal.getState().clear();
    const stateAfterFirst = useEditorStore.getState().project;
    // Manually inject a keyframe at frame 60 into the current state
    const proj = JSON.parse(JSON.stringify(stateAfterFirst)) as typeof stateAfterFirst;
    proj.scenes[0]!.layers[0]!.keyframes.push({
      id: "kf-outside",
      frame: 60,
      property: "opacity",
      value: "0.9",
      easingOut: { type: "linear" },
    });
    useEditorStore.setState({ project: proj });
    useEditorStore.temporal.getState().clear();

    // Re-apply with replace — should remove frames [0,30] opacity but keep frame 60
    useEditorStore.getState().applyAnimationPresetToLayer(LAYER_ID, fadeInPreset, {
      duration: 30,
      easing: { type: "linear" },
      values: { fromOpacity: 0, toOpacity: 1 },
      replaceConflicts: true,
    });

    const kfs = getLayer().keyframes;
    // 2 new from preset + 1 outside range = 3
    expect(kfs).toHaveLength(3);
    expect(kfs.find((k) => k.frame === 60)).toBeDefined();
  });

  it("replaceConflicts: true — preserves keyframe on a different property inside the range", () => {
    // The existing keyframe at frame 15 is on 'opacity' (animatedProperties includes it),
    // but a translateX keyframe at frame 15 is NOT in fade-in's animatedProperties.
    const proj = JSON.parse(
      JSON.stringify(useEditorStore.getState().project),
    ) as Project;
    proj.scenes[0]!.layers[0]!.keyframes.push({
      id: "kf-translatex",
      frame: 15,
      property: "transform.translateX",
      value: "50px",
      easingOut: { type: "linear" },
    });
    useEditorStore.setState({ project: proj });
    useEditorStore.temporal.getState().clear();

    useEditorStore.getState().applyAnimationPresetToLayer(LAYER_ID, fadeInPreset, {
      duration: 30,
      easing: { type: "linear" },
      values: { fromOpacity: 0, toOpacity: 1 },
      replaceConflicts: true,
    });

    const kfs = getLayer().keyframes;
    // opacity at frame 15 removed, translateX at frame 15 kept, 2 new opacity added
    // = 1 (translateX) + 2 (new opacity) = 3 total
    expect(kfs).toHaveLength(3);
    expect(kfs.find((k) => k.property === "transform.translateX")).toBeDefined();
  });
});
