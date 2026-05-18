import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project } from "@open-effects/shared-types";

const LAYER_ID = "layer-1";
const SCENE_ID = "scene-1";

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
      durationFrames: 90,
      transitionIn: null,
      keyframes: [],
      audioTracks: [],
      layers: [
        {
          type: "html" as const,
          id: LAYER_ID,
          order: 0,
          name: "Layer 1",
          html: "",
          css: "",
          startFrame: 0,
          endFrame: 90,
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
  });
}

function getLayer() {
  return useEditorStore
    .getState()
    .project.scenes[0].layers.find((l) => l.id === LAYER_ID)!;
}

describe("keyframe store actions", () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  // ── addKeyframe ─────────────────────────────────────────────────────────────
  it("addKeyframe appends a keyframe with default linear easing when none provided", () => {
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 10, "0.5");
    const kfs = getLayer().keyframes;
    expect(kfs).toHaveLength(1);
    expect(kfs[0].property).toBe("opacity");
    expect(kfs[0].frame).toBe(10);
    expect(kfs[0].value).toBe("0.5");
    expect(kfs[0].easingOut).toEqual({ type: "linear" });
  });

  it("addKeyframe warns and does nothing when property is not in ANIMATABLE_KEYS", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    useEditorStore
      .getState()
      .addKeyframe(LAYER_ID, "not-a-real-property", 10, "1");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("not-a-real-property"),
    );
    expect(getLayer().keyframes).toHaveLength(0);
  });

  it("addKeyframe replaces value when same (layerId, property, frame) already exists", () => {
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 10, "0.5");
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 10, "1.0");
    const kfs = getLayer().keyframes;
    expect(kfs).toHaveLength(1);
    expect(kfs[0].value).toBe("1.0");
  });

  it("addKeyframe updates easing when replacing an existing keyframe", () => {
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 10, "0.5");
    useEditorStore
      .getState()
      .addKeyframe(LAYER_ID, "opacity", 10, "0.5", { type: "ease-in-out" });
    const kfs = getLayer().keyframes;
    expect(kfs).toHaveLength(1);
    expect(kfs[0].easingOut).toEqual({ type: "ease-in-out" });
  });

  // ── deleteKeyframe ──────────────────────────────────────────────────────────
  it("deleteKeyframe removes the matching keyframe", () => {
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 10, "0.5");
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 20, "1.0");
    useEditorStore.getState().deleteKeyframe(LAYER_ID, "opacity", 10);
    const kfs = getLayer().keyframes;
    expect(kfs).toHaveLength(1);
    expect(kfs[0].frame).toBe(20);
  });

  it("deleteKeyframe does nothing if no matching keyframe exists", () => {
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 10, "0.5");
    useEditorStore.getState().deleteKeyframe(LAYER_ID, "opacity", 99);
    expect(getLayer().keyframes).toHaveLength(1);
  });

  // ── moveKeyframe ────────────────────────────────────────────────────────────
  it("moveKeyframe updates the frame of the keyframe", () => {
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 10, "0.5");
    useEditorStore.getState().moveKeyframe(LAYER_ID, "opacity", 10, 30);
    const kfs = getLayer().keyframes;
    expect(kfs).toHaveLength(1);
    expect(kfs[0].frame).toBe(30);
  });

  it("moveKeyframe is a no-op when target frame is already occupied for the same property", () => {
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 10, "0.5");
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 30, "1.0");
    useEditorStore.getState().moveKeyframe(LAYER_ID, "opacity", 10, 30);
    const kfs = getLayer().keyframes;
    // Both keyframes should remain unchanged
    expect(kfs).toHaveLength(2);
    const kf10 = kfs.find((k) => k.frame === 10);
    const kf30 = kfs.find((k) => k.frame === 30);
    expect(kf10).toBeDefined();
    expect(kf30).toBeDefined();
  });

  // ── updateKeyframeValue ─────────────────────────────────────────────────────
  it("updateKeyframeValue mutates only the targeted keyframe", () => {
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 10, "0.5");
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 20, "0.8");
    useEditorStore
      .getState()
      .updateKeyframeValue(LAYER_ID, "opacity", 10, "0.1");
    const kfs = getLayer().keyframes;
    const kf10 = kfs.find((k) => k.frame === 10)!;
    const kf20 = kfs.find((k) => k.frame === 20)!;
    expect(kf10.value).toBe("0.1");
    expect(kf20.value).toBe("0.8");
  });

  // ── updateKeyframeEasing ────────────────────────────────────────────────────
  it("updateKeyframeEasing mutates easingOut of the targeted keyframe", () => {
    useEditorStore.getState().addKeyframe(LAYER_ID, "opacity", 10, "0.5");
    useEditorStore
      .getState()
      .updateKeyframeEasing(LAYER_ID, "opacity", 10, { type: "ease-in" });
    const kf = getLayer().keyframes.find((k) => k.frame === 10)!;
    expect(kf.easingOut).toEqual({ type: "ease-in" });
  });
});
