import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { ProjectSchema, type Project } from "@open-effects/shared-types";
import { persistProjectJson } from "@/lib/persistence/persistProjectJson";
import { toProjectJson } from "@/lib/persistence";
import { createId } from "@paralleldrive/cuid2";

describe("persistProjectJson", () => {
  beforeEach(async () => {
    await db.project.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  // Helper: create a bare project row with no scenes
  async function seedProject(overrides: { name?: string; fps?: number } = {}) {
    return db.project.create({
      data: {
        name: overrides.name ?? "Test Project",
        width: 1920,
        height: 1080,
        fps: overrides.fps ?? 30,
      },
    });
  }

  // Helper: build a minimal valid Project object for a given DB project id
  function buildProject(projectId: string, scenesInput: unknown = []): Project {
    return ProjectSchema.parse({
      id: projectId,
      name: "Test Project",
      width: 1920,
      height: 1080,
      fps: 30,
      scenes: scenesInput,
    });
  }

  it("inserts scenes and layers for a project with 2 scenes × 2 layers each", async () => {
    const row = await seedProject();

    const project = buildProject(row.id, [
      {
        id: createId(),
        order: 0,
        durationFrames: 120,
        transitionIn: null,
        layers: [
          {
            id: createId(),
            order: 0,
            name: "Layer A",
            html: "<p>A</p>",
            css: "p{color:red}",
            startFrame: 0,
            endFrame: 120,
            visible: true,
            keyframes: [],
          },
          {
            id: createId(),
            order: 1,
            name: "Layer B",
            html: "<p>B</p>",
            css: "",
            startFrame: 0,
            endFrame: 120,
            visible: true,
            keyframes: [],
          },
        ],
        audioTracks: [],
      },
      {
        id: createId(),
        order: 1,
        durationFrames: 60,
        transitionIn: null,
        layers: [
          {
            id: createId(),
            order: 0,
            name: "Layer C",
            html: "<p>C</p>",
            css: "",
            startFrame: 0,
            endFrame: 60,
            visible: true,
            keyframes: [],
          },
          {
            id: createId(),
            order: 1,
            name: "Layer D",
            html: "<p>D</p>",
            css: "",
            startFrame: 0,
            endFrame: 60,
            visible: true,
            keyframes: [],
          },
        ],
        audioTracks: [],
      },
    ]);

    await persistProjectJson(row.id, project);

    const sceneCount = await db.scene.count({ where: { projectId: row.id } });
    const layerCount = await db.layer.count({
      where: { scene: { projectId: row.id } },
    });

    expect(sceneCount).toBe(2);
    expect(layerCount).toBe(4);
  });

  it("replaces scenes/layers on a second call (delete + insert strategy)", async () => {
    const row = await seedProject();

    // First persist: 2 scenes × 2 layers = 4 layers
    const first = buildProject(row.id, [
      {
        id: createId(),
        order: 0,
        durationFrames: 120,
        transitionIn: null,
        layers: [
          {
            id: createId(),
            order: 0,
            name: "Old Layer A",
            html: "<p>old</p>",
            css: "",
            startFrame: 0,
            endFrame: 120,
            visible: true,
            keyframes: [],
          },
          {
            id: createId(),
            order: 1,
            name: "Old Layer B",
            html: "<p>old</p>",
            css: "",
            startFrame: 0,
            endFrame: 120,
            visible: true,
            keyframes: [],
          },
        ],
        audioTracks: [],
      },
      {
        id: createId(),
        order: 1,
        durationFrames: 60,
        transitionIn: null,
        layers: [
          {
            id: createId(),
            order: 0,
            name: "Old Layer C",
            html: "<p>old</p>",
            css: "",
            startFrame: 0,
            endFrame: 60,
            visible: true,
            keyframes: [],
          },
          {
            id: createId(),
            order: 1,
            name: "Old Layer D",
            html: "<p>old</p>",
            css: "",
            startFrame: 0,
            endFrame: 60,
            visible: true,
            keyframes: [],
          },
        ],
        audioTracks: [],
      },
    ]);
    await persistProjectJson(row.id, first);

    // Second persist: 1 scene × 1 layer — should replace everything
    const second = buildProject(row.id, [
      {
        id: createId(),
        order: 0,
        durationFrames: 90,
        transitionIn: null,
        layers: [
          {
            id: createId(),
            order: 0,
            name: "New Layer",
            html: "<p>new</p>",
            css: "p{color:blue}",
            startFrame: 0,
            endFrame: 90,
            visible: true,
            keyframes: [],
          },
        ],
        audioTracks: [],
      },
    ]);
    await persistProjectJson(row.id, second);

    const sceneCount = await db.scene.count({ where: { projectId: row.id } });
    const layerCount = await db.layer.count({
      where: { scene: { projectId: row.id } },
    });
    const layers = await db.layer.findMany({
      where: { scene: { projectId: row.id } },
    });

    expect(sceneCount).toBe(1);
    expect(layerCount).toBe(1);
    expect(layers[0].name).toBe("New Layer");
  });

  it("round-trips: persist → toProjectJson returns equivalent JSON (2 scenes × 3 layers with HTML+CSS + keyframes)", async () => {
    const row = await seedProject({ name: "Round-trip Project", fps: 24 });

    const sceneId0 = createId();
    const sceneId1 = createId();
    const layerId0 = createId();
    const layerId1 = createId();
    const layerId2 = createId();
    const layerId3 = createId();
    const layerId4 = createId();
    const layerId5 = createId();
    const keyframeId0 = createId();
    const keyframeId1 = createId();

    const project: Project = ProjectSchema.parse({
      id: row.id,
      name: "Round-trip Project",
      width: 1920,
      height: 1080,
      fps: 24,
      scenes: [
        {
          id: sceneId0,
          order: 0,
          durationFrames: 240,
          transitionIn: null,
          layers: [
            {
              id: layerId0,
              order: 0,
              name: "Title",
              html: "<h1>Hello World</h1>",
              css: "h1 { font-size: 48px; color: white; }",
              startFrame: 0,
              endFrame: 240,
              visible: true,
              keyframes: [
                {
                  id: keyframeId0,
                  frame: 0,
                  property: "opacity",
                  value: "0",
                  easingOut: { type: "linear" },
                },
                {
                  id: keyframeId1,
                  frame: 30,
                  property: "opacity",
                  value: "1",
                  easingOut: { type: "linear" },
                },
              ],
            },
            {
              id: layerId1,
              order: 1,
              name: "Background",
              html: "<div class='bg'></div>",
              css: ".bg { background: #000; width: 100%; height: 100%; }",
              startFrame: 0,
              endFrame: 240,
              visible: true,
              keyframes: [],
            },
            {
              id: layerId2,
              order: 2,
              name: "Subtitle",
              html: "<p>Open Effects</p>",
              css: "p { color: #aaa; font-size: 24px; }",
              startFrame: 30,
              endFrame: 210,
              visible: true,
              keyframes: [],
            },
          ],
          audioTracks: [],
        },
        {
          id: sceneId1,
          order: 1,
          durationFrames: 120,
          transitionIn: null,
          layers: [
            {
              id: layerId3,
              order: 0,
              name: "Scene 2 Layer A",
              html: "<div>A</div>",
              css: "div { color: red; }",
              startFrame: 0,
              endFrame: 120,
              visible: true,
              keyframes: [],
            },
            {
              id: layerId4,
              order: 1,
              name: "Scene 2 Layer B",
              html: "<div>B</div>",
              css: "div { color: green; }",
              startFrame: 0,
              endFrame: 120,
              visible: true,
              keyframes: [],
            },
            {
              id: layerId5,
              order: 2,
              name: "Scene 2 Layer C",
              html: "<div>C</div>",
              css: "div { color: blue; }",
              startFrame: 0,
              endFrame: 120,
              visible: true,
              keyframes: [],
            },
          ],
          audioTracks: [],
        },
      ],
    });

    await persistProjectJson(row.id, project);
    const result = await toProjectJson(row.id);

    // Root fields
    expect(result.id).toBe(row.id);
    expect(result.name).toBe("Round-trip Project");
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.fps).toBe(24);

    // Scene count
    expect(result.scenes).toHaveLength(2);

    const scene0 = result.scenes.find((s) => s.id === sceneId0)!;
    expect(scene0).toBeDefined();
    expect(scene0.durationFrames).toBe(240);
    expect(scene0.transitionIn).toBeNull();
    expect(scene0.layers).toHaveLength(3);

    // Layer with keyframes
    const titleLayer = scene0.layers.find((l) => l.id === layerId0)!;
    expect(titleLayer.name).toBe("Title");
    expect(titleLayer.html).toBe("<h1>Hello World</h1>");
    expect(titleLayer.css).toBe("h1 { font-size: 48px; color: white; }");
    expect(titleLayer.keyframes).toHaveLength(2);

    const kf0 = titleLayer.keyframes.find((k) => k.id === keyframeId0)!;
    expect(kf0.frame).toBe(0);
    expect(kf0.property).toBe("opacity");
    expect(kf0.value).toBe("0");
    expect(kf0.easingOut).toEqual({ type: "linear" });

    // Scene 1
    const scene1 = result.scenes.find((s) => s.id === sceneId1)!;
    expect(scene1).toBeDefined();
    expect(scene1.layers).toHaveLength(3);
  });

  it("throws a validation error for invalid fps without touching DB (validation before transaction)", async () => {
    const row = await seedProject();

    const badProject = {
      id: row.id,
      name: "Bad Project",
      width: 1920,
      height: 1080,
      fps: 50, // invalid — only 24 | 30 | 60 allowed
      scenes: [],
    };

    await expect(
      persistProjectJson(row.id, badProject as unknown as Project),
    ).rejects.toThrow();

    // DB should be untouched — no scenes created
    const sceneCount = await db.scene.count({ where: { projectId: row.id } });
    expect(sceneCount).toBe(0);
  });
});
