import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/editor/store";
import type {
  Project,
  SavedComponentPayload,
} from "@open-effects/shared-types";

const makeProject = (): Project => ({
  id: "proj-1",
  name: "Test Project",
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [],
});

function resetStore(
  partial?: Partial<Parameters<typeof useEditorStore.setState>[0]>,
) {
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
    expect(useEditorStore.getState().project.scenes[0].durationFrames).toBe(
      120,
    );
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
    const initialLength =
      useEditorStore.getState().project.scenes[0].layers.length;
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

  // ── insertSavedComponent ──────────────────────────────────────────────────
  it("insertSavedComponent appends layers with re-based frames and correct orders", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    const scene = useEditorStore.getState().project.scenes[0];

    // Replace default layers with 2 seeded layers (orders 0, 1)
    useEditorStore.setState((s) => ({
      project: {
        ...s.project,
        scenes: s.project.scenes.map((sc) =>
          sc.id === scene.id
            ? {
                ...sc,
                layers: [
                  { ...sc.layers[0], order: 0 },
                  { ...sc.layers[0], id: "seed-layer-2", order: 1 },
                ],
              }
            : sc,
        ),
      },
      selectedSceneId: scene.id,
      currentFrame: 50,
    }));

    const payload: SavedComponentPayload = {
      layers: [
        {
          id: "orig-1",
          name: "Layer A",
          order: 0,
          startFrame: 0,
          endFrame: 30,
          html: "",
          css: "",
          visible: true,
          keyframes: [],
        },
        {
          id: "orig-2",
          name: "Layer B",
          order: 1,
          startFrame: 7,
          endFrame: 55,
          html: "",
          css: "",
          visible: true,
          keyframes: [],
        },
      ],
    };

    useEditorStore.getState().insertSavedComponent(payload);

    const layers = useEditorStore.getState().project.scenes[0].layers;
    expect(layers).toHaveLength(4);

    const newLayerA = layers[2];
    const newLayerB = layers[3];

    expect(newLayerA.order).toBe(2);
    expect(newLayerB.order).toBe(3);

    expect(newLayerA.startFrame).toBe(50);
    expect(newLayerA.endFrame).toBe(80);

    expect(newLayerB.startFrame).toBe(57);
    expect(newLayerB.endFrame).toBe(105);
  });

  it("insertSavedComponent with explicit sceneId targets that scene", () => {
    const { addScene } = useEditorStore.getState();
    addScene();
    addScene();
    const scenes = useEditorStore.getState().project.scenes;
    const targetScene = scenes[1];

    useEditorStore.setState({ selectedSceneId: scenes[0].id, currentFrame: 0 });

    // Clear layers from target scene for a clean count
    useEditorStore.setState((s) => ({
      project: {
        ...s.project,
        scenes: s.project.scenes.map((sc) =>
          sc.id === targetScene.id ? { ...sc, layers: [] } : sc,
        ),
      },
    }));

    const payload: SavedComponentPayload = {
      layers: [
        {
          id: "orig-1",
          name: "Layer A",
          order: 0,
          startFrame: 0,
          endFrame: 10,
          html: "",
          css: "",
          visible: true,
          keyframes: [],
        },
      ],
    };

    useEditorStore.getState().insertSavedComponent(payload, targetScene.id);

    const scene0Layers = useEditorStore.getState().project.scenes[0].layers;
    const scene1Layers = useEditorStore.getState().project.scenes[1].layers;

    // First scene should be unchanged (still has default layers, target was scene1)
    expect(scene1Layers).toHaveLength(1);
    // Verify first scene was not modified
    expect(scene0Layers.length).toBeGreaterThan(0);
    expect(scene0Layers.find((l) => l.name === "Layer A")).toBeUndefined();
  });
});
