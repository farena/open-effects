import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project } from "@open-effects/shared-types";

const SCENE_ID = "scene-1";
const TRACK_ID = "track-1";
const LAYER_ID = "layer-1";

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
      audioTracks: [
        {
          id: TRACK_ID,
          assetId: "asset-1",
          assetPath: "/audio/track.mp3",
          startFrame: 0,
          trimStart: 0,
          trimEnd: 90,
          eq: null,
          volumeKeyframes: [],
        },
      ],
      layers: [
        {
          id: LAYER_ID,
          order: 0,
          name: "Layer 1",
          html: "<div></div>",
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
    selectedLayerId: null,
    selectedAudioTrackId: null,
    currentFrame: 0,
    isPlaying: false,
    saveStatus: "idle",
    lastSavedAt: null,
  });
}

function getTrack() {
  return useEditorStore
    .getState()
    .project.scenes.find((sc) => sc.id === SCENE_ID)!
    .audioTracks.find((t) => t.id === TRACK_ID)!;
}

describe("audio fx store actions", () => {
  beforeEach(() => {
    resetStore();
  });

  // ── selectAudioTrack ───────────────────────────────────────────────────────
  describe("selectAudioTrack", () => {
    it("sets selectedAudioTrackId", () => {
      useEditorStore.getState().selectAudioTrack(TRACK_ID);
      expect(useEditorStore.getState().selectedAudioTrackId).toBe(TRACK_ID);
    });

    it("clears selectedLayerId when a track is selected", () => {
      useEditorStore.setState({ selectedLayerId: LAYER_ID });
      useEditorStore.getState().selectAudioTrack(TRACK_ID);
      expect(useEditorStore.getState().selectedLayerId).toBeNull();
    });

    it("can be cleared by passing null", () => {
      useEditorStore.getState().selectAudioTrack(TRACK_ID);
      useEditorStore.getState().selectAudioTrack(null);
      expect(useEditorStore.getState().selectedAudioTrackId).toBeNull();
    });

    it("does not clear selectedLayerId when passing null", () => {
      useEditorStore.setState({ selectedLayerId: LAYER_ID });
      useEditorStore.getState().selectAudioTrack(null);
      expect(useEditorStore.getState().selectedLayerId).toBe(LAYER_ID);
    });
  });

  // ── selectLayer clears selectedAudioTrackId ────────────────────────────────
  describe("selectLayer clears selectedAudioTrackId", () => {
    it("clears selectedAudioTrackId when a layer is selected", () => {
      useEditorStore.setState({ selectedAudioTrackId: TRACK_ID });
      useEditorStore.getState().selectLayer(LAYER_ID);
      expect(useEditorStore.getState().selectedAudioTrackId).toBeNull();
    });

    it("does not clear selectedAudioTrackId when selectLayer(null) is called", () => {
      useEditorStore.setState({ selectedAudioTrackId: TRACK_ID });
      useEditorStore.getState().selectLayer(null);
      expect(useEditorStore.getState().selectedAudioTrackId).toBe(TRACK_ID);
    });
  });

  // ── addVolumeKeyframe ──────────────────────────────────────────────────────
  describe("addVolumeKeyframe", () => {
    it("appends a volume keyframe with default linear easing", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      const kfs = getTrack().volumeKeyframes;
      expect(kfs).toHaveLength(1);
      expect(kfs[0].frame).toBe(10);
      expect(kfs[0].value).toBe(0.5);
      expect(kfs[0].easingOut).toEqual({ type: "linear" });
    });

    it("clamps value above 1 to 1", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 5, 1.5);
      expect(getTrack().volumeKeyframes[0].value).toBe(1);
    });

    it("clamps value below 0 to 0", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 5, -0.5);
      expect(getTrack().volumeKeyframes[0].value).toBe(0);
    });

    it("uses the provided easingOut", () => {
      useEditorStore
        .getState()
        .addVolumeKeyframe(TRACK_ID, 10, 0.8, { type: "ease-in" });
      expect(getTrack().volumeKeyframes[0].easingOut).toEqual({
        type: "ease-in",
      });
    });

    it("replaces value and easing when frame already exists", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore
        .getState()
        .addVolumeKeyframe(TRACK_ID, 10, 0.9, { type: "ease-out" });
      const kfs = getTrack().volumeKeyframes;
      expect(kfs).toHaveLength(1);
      expect(kfs[0].value).toBe(0.9);
      expect(kfs[0].easingOut).toEqual({ type: "ease-out" });
    });

    it("appends multiple keyframes at different frames", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 0, 0);
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 30, 1);
      expect(getTrack().volumeKeyframes).toHaveLength(2);
    });
  });

  // ── deleteVolumeKeyframe ───────────────────────────────────────────────────
  describe("deleteVolumeKeyframe", () => {
    it("removes the matching keyframe", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 20, 1.0);
      useEditorStore.getState().deleteVolumeKeyframe(TRACK_ID, 10);
      const kfs = getTrack().volumeKeyframes;
      expect(kfs).toHaveLength(1);
      expect(kfs[0].frame).toBe(20);
    });

    it("is a no-op when frame does not exist", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore.getState().deleteVolumeKeyframe(TRACK_ID, 99);
      expect(getTrack().volumeKeyframes).toHaveLength(1);
    });
  });

  // ── moveVolumeKeyframe ─────────────────────────────────────────────────────
  describe("moveVolumeKeyframe", () => {
    it("updates the frame of the matching keyframe", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore.getState().moveVolumeKeyframe(TRACK_ID, 10, 20);
      const kfs = getTrack().volumeKeyframes;
      expect(kfs[0].frame).toBe(20);
    });

    it("is a no-op when toFrame collides with an existing keyframe", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 20, 1.0);
      useEditorStore.getState().moveVolumeKeyframe(TRACK_ID, 10, 20);
      const frames = getTrack().volumeKeyframes.map((k) => k.frame);
      expect(frames).toContain(10);
      expect(frames.filter((f) => f === 20)).toHaveLength(1);
    });

    it("is a no-op when fromFrame does not exist", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore.getState().moveVolumeKeyframe(TRACK_ID, 99, 30);
      expect(getTrack().volumeKeyframes[0].frame).toBe(10);
    });
  });

  // ── updateVolumeKeyframeValue ──────────────────────────────────────────────
  describe("updateVolumeKeyframeValue", () => {
    it("mutates the value of the matching keyframe", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore.getState().updateVolumeKeyframeValue(TRACK_ID, 10, 0.75);
      expect(getTrack().volumeKeyframes[0].value).toBe(0.75);
    });

    it("clamps the updated value to [0..1]", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore.getState().updateVolumeKeyframeValue(TRACK_ID, 10, 2.0);
      expect(getTrack().volumeKeyframes[0].value).toBe(1);
      useEditorStore.getState().updateVolumeKeyframeValue(TRACK_ID, 10, -1.0);
      expect(getTrack().volumeKeyframes[0].value).toBe(0);
    });

    it("does not affect other keyframes", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 20, 0.8);
      useEditorStore.getState().updateVolumeKeyframeValue(TRACK_ID, 10, 0.3);
      expect(
        getTrack().volumeKeyframes.find((k) => k.frame === 20)?.value,
      ).toBe(0.8);
    });
  });

  // ── updateVolumeKeyframeEasing ─────────────────────────────────────────────
  describe("updateVolumeKeyframeEasing", () => {
    it("mutates the easingOut of the matching keyframe", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore
        .getState()
        .updateVolumeKeyframeEasing(TRACK_ID, 10, { type: "ease-in-out" });
      expect(getTrack().volumeKeyframes[0].easingOut).toEqual({
        type: "ease-in-out",
      });
    });

    it("is a no-op when frame does not exist", () => {
      useEditorStore.getState().addVolumeKeyframe(TRACK_ID, 10, 0.5);
      useEditorStore
        .getState()
        .updateVolumeKeyframeEasing(TRACK_ID, 99, { type: "ease-in" });
      expect(getTrack().volumeKeyframes[0].easingOut).toEqual({
        type: "linear",
      });
    });
  });

  // ── setAudioTrackEq ────────────────────────────────────────────────────────
  describe("setAudioTrackEq", () => {
    it("sets the EQ bands on the track", () => {
      useEditorStore.getState().setAudioTrackEq(TRACK_ID, {
        low: 3,
        mid: 0,
        high: 0,
        presence: 6,
      });
      expect(getTrack().eq).toEqual({ low: 3, mid: 0, high: 0, presence: 6 });
    });

    it("clears EQ when passing null", () => {
      useEditorStore.getState().setAudioTrackEq(TRACK_ID, {
        low: 3,
        mid: 0,
        high: 0,
        presence: 6,
      });
      useEditorStore.getState().setAudioTrackEq(TRACK_ID, null);
      expect(getTrack().eq).toBeNull();
    });

    it("is a no-op for unknown trackId", () => {
      useEditorStore
        .getState()
        .setAudioTrackEq("nonexistent", {
          low: 1,
          mid: 1,
          high: 1,
          presence: 1,
        });
      expect(getTrack().eq).toBeNull();
    });
  });
});
