import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project } from "@open-effects/shared-types";

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
      layers: [],
    },
  ],
});

function resetStore(currentFrame = 0) {
  useEditorStore.setState({
    project: makeProject(),
    selectedSceneId: SCENE_ID,
    selectedLayerId: null,
    currentFrame,
    isPlaying: false,
    saveStatus: "idle",
    lastSavedAt: null,
  });
}

function getScene() {
  return useEditorStore
    .getState()
    .project.scenes.find((sc) => sc.id === SCENE_ID)!;
}

describe("audio track store actions", () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  // ── addAudioTrack ──────────────────────────────────────────────────────────
  it("addAudioTrack appends a track to the scene", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const tracks = getScene().audioTracks;
    expect(tracks).toHaveLength(1);
  });

  it("addAudioTrack sets startFrame to currentFrame", () => {
    resetStore(15);
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const track = getScene().audioTracks[0];
    expect(track.startFrame).toBe(15);
  });

  it("addAudioTrack sets trimStart=0 and trimEnd=durationFrames", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const track = getScene().audioTracks[0];
    expect(track.trimStart).toBe(0);
    expect(track.trimEnd).toBe(60);
  });

  it("addAudioTrack sets eq=null and volumeKeyframes=[]", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const track = getScene().audioTracks[0];
    expect(track.eq).toBeNull();
    expect(track.volumeKeyframes).toEqual([]);
  });

  it("addAudioTrack sets correct assetId and assetPath", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const track = getScene().audioTracks[0];
    expect(track.assetId).toBe("asset-1");
    expect(track.assetPath).toBe("/audio/track.mp3");
  });

  it("addAudioTrack generates a unique id", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-2",
      path: "/audio/other.mp3",
      durationFrames: 30,
    });
    const tracks = getScene().audioTracks;
    expect(tracks).toHaveLength(2);
    expect(tracks[0].id).not.toBe(tracks[1].id);
  });

  it("addAudioTrack does nothing when sceneId does not exist", () => {
    useEditorStore.getState().addAudioTrack("nonexistent-scene", {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const tracks = getScene().audioTracks;
    expect(tracks).toHaveLength(0);
  });

  // ── removeAudioTrack ───────────────────────────────────────────────────────
  it("removeAudioTrack removes the track from its scene", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const trackId = getScene().audioTracks[0].id;
    useEditorStore.getState().removeAudioTrack(trackId);
    expect(getScene().audioTracks).toHaveLength(0);
  });

  it("removeAudioTrack does nothing when trackId does not exist", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    useEditorStore.getState().removeAudioTrack("nonexistent-track");
    expect(getScene().audioTracks).toHaveLength(1);
  });

  // ── moveAudioTrack ─────────────────────────────────────────────────────────
  it("moveAudioTrack updates startFrame", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const trackId = getScene().audioTracks[0].id;
    useEditorStore.getState().moveAudioTrack(trackId, 30);
    expect(getScene().audioTracks[0].startFrame).toBe(30);
  });

  it("moveAudioTrack clamps startFrame to >= 0", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const trackId = getScene().audioTracks[0].id;
    useEditorStore.getState().moveAudioTrack(trackId, -10);
    expect(getScene().audioTracks[0].startFrame).toBe(0);
  });

  // ── trimAudioTrack ─────────────────────────────────────────────────────────
  it("trimAudioTrack updates trimStart and trimEnd", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const trackId = getScene().audioTracks[0].id;
    useEditorStore.getState().trimAudioTrack(trackId, 5, 50);
    const track = getScene().audioTracks[0];
    expect(track.trimStart).toBe(5);
    expect(track.trimEnd).toBe(50);
  });

  it("trimAudioTrack is a no-op when trimEnd <= trimStart", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const trackId = getScene().audioTracks[0].id;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    useEditorStore.getState().trimAudioTrack(trackId, 30, 30);
    const track = getScene().audioTracks[0];
    expect(track.trimStart).toBe(0);
    expect(track.trimEnd).toBe(60);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("trimAudioTrack warns and is no-op when trimEnd < trimStart", () => {
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-1",
      path: "/audio/track.mp3",
      durationFrames: 60,
    });
    const trackId = getScene().audioTracks[0].id;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    useEditorStore.getState().trimAudioTrack(trackId, 40, 20);
    const track = getScene().audioTracks[0];
    expect(track.trimStart).toBe(0);
    expect(track.trimEnd).toBe(60);
    expect(warnSpy).toHaveBeenCalled();
  });
});
