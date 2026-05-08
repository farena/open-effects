import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project } from "@open-effects/shared-types";

const makeProject = (): Project => ({
  id: "proj-1",
  name: "Test Project",
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [
    {
      id: "scene-1",
      order: 0,
      name: "Scene 1",
      background: "#000000",
      durationFrames: 60,
      keyframes: [],
      layers: [],
      audioTracks: [],
    },
  ],
});

function resetStore() {
  useEditorStore.setState({
    project: makeProject(),
    selectedSceneId: "scene-1",
    selectedLayerId: null,
    selectedAudioTrackId: null,
    currentFrame: 0,
    isPlaying: false,
    saveStatus: "idle",
    lastSavedAt: null,
  });
  useEditorStore.temporal.getState().clear();
}

describe("undo / redo", () => {
  beforeEach(() => {
    resetStore();
  });

  it("addLayer adds an entry to pastStates", () => {
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(0);
    useEditorStore.getState().addLayer("scene-1");
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(1);
  });

  it("undo() reverses addLayer", () => {
    useEditorStore.getState().addLayer("scene-1");
    expect(useEditorStore.getState().project.scenes[0]!.layers.length).toBe(1);
    useEditorStore.temporal.getState().undo();
    expect(useEditorStore.getState().project.scenes[0]!.layers.length).toBe(0);
  });

  it("redo() re-applies the undone change", () => {
    useEditorStore.getState().addLayer("scene-1");
    useEditorStore.temporal.getState().undo();
    expect(useEditorStore.getState().project.scenes[0]!.layers.length).toBe(0);
    useEditorStore.temporal.getState().redo();
    expect(useEditorStore.getState().project.scenes[0]!.layers.length).toBe(1);
  });

  it("multiple addLayer + multiple undo round-trips correctly", () => {
    const s = useEditorStore.getState();
    s.addLayer("scene-1");
    s.addLayer("scene-1");
    s.addLayer("scene-1");
    expect(useEditorStore.getState().project.scenes[0]!.layers.length).toBe(3);
    const t = useEditorStore.temporal.getState;
    t().undo();
    t().undo();
    t().undo();
    expect(useEditorStore.getState().project.scenes[0]!.layers.length).toBe(0);
    t().redo();
    t().redo();
    t().redo();
    expect(useEditorStore.getState().project.scenes[0]!.layers.length).toBe(3);
  });
});

describe("ephemeral mutations are excluded from undo history", () => {
  beforeEach(() => {
    resetStore();
  });

  it("selectLayer does NOT add to pastStates", () => {
    const before = useEditorStore.temporal.getState().pastStates.length;
    useEditorStore.getState().selectLayer(null);
    useEditorStore.getState().selectLayer("doesnt-exist");
    useEditorStore.getState().selectLayer(null);
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(before);
  });

  it("setCurrentFrame does NOT add to pastStates", () => {
    const before = useEditorStore.temporal.getState().pastStates.length;
    useEditorStore.getState().setCurrentFrame(10);
    useEditorStore.getState().setCurrentFrame(42);
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(before);
  });

  it("play / pause do NOT add to pastStates", () => {
    const before = useEditorStore.temporal.getState().pastStates.length;
    useEditorStore.getState().play();
    useEditorStore.getState().pause();
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(before);
  });

  it("setSaveStatus / markSaved do NOT add to pastStates", () => {
    const before = useEditorStore.temporal.getState().pastStates.length;
    useEditorStore.getState().setSaveStatus("saving");
    useEditorStore.getState().markSaved();
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(before);
  });

  it("selectScene / selectAudioTrack do NOT add to pastStates", () => {
    const before = useEditorStore.temporal.getState().pastStates.length;
    useEditorStore.getState().selectScene("scene-1");
    useEditorStore.getState().selectAudioTrack(null);
    expect(useEditorStore.temporal.getState().pastStates.length).toBe(before);
  });
});
