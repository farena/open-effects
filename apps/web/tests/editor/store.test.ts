import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project } from "@open-effects/shared-types";

const makeProject = (): Project => ({
  id: "proj-1",
  name: "Test Project",
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [],
});

function resetStore(partial?: Partial<Parameters<typeof useEditorStore.setState>[0]>) {
  useEditorStore.setState({
    project: makeProject(),
    selectedSceneId: null,
    selectedLayerId: null,
    currentFrame: 0,
    isPlaying: false,
    saveStatus: "idle",
    lastSavedAt: null,
    ...partial,
  });
}

describe("useEditorStore", () => {
  beforeEach(() => {
    resetStore();
  });

  // ── addScene ──────────────────────────────────────────────────────────────
  it("addScene increments scene count", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    const { project } = useEditorStore.getState();
    expect(project.scenes).toHaveLength(1);
  });

  it("addScene sets order to last+1", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    addScene();
    const { project } = useEditorStore.getState();
    expect(project.scenes[0].order).toBe(0);
    expect(project.scenes[1].order).toBe(1);
  });

  it("addScene uses default duration of 90", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    const { project } = useEditorStore.getState();
    expect(project.scenes[0].durationFrames).toBe(90);
  });

  // ── deleteScene ───────────────────────────────────────────────────────────
  it("deleteScene removes the scene", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    addScene();
    const sceneId = useEditorStore.getState().project.scenes[0].id;
    useEditorStore.getState().deleteScene(sceneId);
    const { project } = useEditorStore.getState();
    expect(project.scenes).toHaveLength(1);
    expect(project.scenes.find((s) => s.id === sceneId)).toBeUndefined();
  });

  it("deleteScene clears selectedSceneId if it was the deleted scene", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    const sceneId = useEditorStore.getState().project.scenes[0].id;
    useEditorStore.setState({ selectedSceneId: sceneId });
    useEditorStore.getState().deleteScene(sceneId);
    expect(useEditorStore.getState().selectedSceneId).toBeNull();
  });

  // ── reorderScenes ─────────────────────────────────────────────────────────
  it("reorderScenes updates order to match new array order", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    addScene();
    addScene();
    const scenes = useEditorStore.getState().project.scenes;
    const [a, b, c] = scenes;
    // Reverse the order
    useEditorStore.getState().reorderScenes([c.id, b.id, a.id]);
    const updated = useEditorStore.getState().project.scenes;
    expect(updated[0].id).toBe(c.id);
    expect(updated[0].order).toBe(0);
    expect(updated[1].id).toBe(b.id);
    expect(updated[1].order).toBe(1);
    expect(updated[2].id).toBe(a.id);
    expect(updated[2].order).toBe(2);
  });

  // ── setSceneDuration ──────────────────────────────────────────────────────
  it("setSceneDuration updates the scene duration", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    const sceneId = useEditorStore.getState().project.scenes[0].id;
    useEditorStore.getState().setSceneDuration(sceneId, 120);
    expect(useEditorStore.getState().project.scenes[0].durationFrames).toBe(120);
  });

  it("setSceneDuration clamps layer endFrame to new duration", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    const scene = useEditorStore.getState().project.scenes[0];
    // The default layer spans 0..90; set duration to 60
    useEditorStore.getState().setSceneDuration(scene.id, 60);
    const updatedScene = useEditorStore.getState().project.scenes[0];
    for (const layer of updatedScene.layers) {
      expect(layer.endFrame).toBeLessThanOrEqual(60);
    }
  });

  // ── addLayer ──────────────────────────────────────────────────────────────
  it("addLayer appends a layer with order = layers.length (before add)", () => {
    const { addScene, addLayer } = useEditorStore.getState();
    addScene();
    const sceneId = useEditorStore.getState().project.scenes[0].id;
    const initialLength = useEditorStore.getState().project.scenes[0].layers.length;
    addLayer(sceneId);
    const layers = useEditorStore.getState().project.scenes[0].layers;
    expect(layers).toHaveLength(initialLength + 1);
    expect(layers[layers.length - 1].order).toBe(initialLength);
  });

  it("addLayer sets frames 0..sceneDuration", () => {
    const { addScene, addLayer } = useEditorStore.getState();
    addScene();
    const sceneId = useEditorStore.getState().project.scenes[0].id;
    const duration = useEditorStore.getState().project.scenes[0].durationFrames;
    // Clear existing layers to simplify
    useEditorStore.setState((s) => ({
      project: {
        ...s.project,
        scenes: s.project.scenes.map((sc) =>
          sc.id === sceneId ? { ...sc, layers: [] } : sc,
        ),
      },
    }));
    addLayer(sceneId);
    const layers = useEditorStore.getState().project.scenes[0].layers;
    expect(layers[0].startFrame).toBe(0);
    expect(layers[0].endFrame).toBe(duration);
  });

  // ── deleteLayer ───────────────────────────────────────────────────────────
  it("deleteLayer removes the layer", () => {
    const { addScene, addLayer } = useEditorStore.getState();
    addScene();
    const sceneId = useEditorStore.getState().project.scenes[0].id;
    addLayer(sceneId);
    const layers = useEditorStore.getState().project.scenes[0].layers;
    const layerId = layers[0].id;
    useEditorStore.getState().deleteLayer(layerId);
    const after = useEditorStore.getState().project.scenes[0].layers;
    expect(after.find((l) => l.id === layerId)).toBeUndefined();
  });

  it("deleteLayer clears selectedLayerId if it was the deleted layer", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    const layer = useEditorStore.getState().project.scenes[0].layers[0];
    useEditorStore.setState({ selectedLayerId: layer.id });
    useEditorStore.getState().deleteLayer(layer.id);
    expect(useEditorStore.getState().selectedLayerId).toBeNull();
  });

  // ── reorderLayers ─────────────────────────────────────────────────────────
  it("reorderLayers updates layer order", () => {
    const { addScene, addLayer } = useEditorStore.getState();
    addScene();
    const sceneId = useEditorStore.getState().project.scenes[0].id;
    // Scene starts with 1 default layer; add two more
    addLayer(sceneId);
    addLayer(sceneId);
    const layers = useEditorStore.getState().project.scenes[0].layers;
    const [a, b, c] = layers;
    useEditorStore.getState().reorderLayers(sceneId, [c.id, a.id, b.id]);
    const updated = useEditorStore.getState().project.scenes[0].layers;
    expect(updated[0].id).toBe(c.id);
    expect(updated[0].order).toBe(0);
    expect(updated[1].id).toBe(a.id);
    expect(updated[1].order).toBe(1);
    expect(updated[2].id).toBe(b.id);
    expect(updated[2].order).toBe(2);
  });

  // ── updateLayerHtml ───────────────────────────────────────────────────────
  it("updateLayerHtml mutates the right layer", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    const layer = useEditorStore.getState().project.scenes[0].layers[0];
    useEditorStore.getState().updateLayerHtml(layer.id, "<p>hello</p>");
    const updated = useEditorStore
      .getState()
      .project.scenes[0].layers.find((l) => l.id === layer.id);
    expect(updated?.html).toBe("<p>hello</p>");
  });
});
