import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ProjectSchema } from "@open-effects/shared-types";
import { toProjectJson } from "@/lib/persistence";

describe("toProjectJson", () => {
  beforeEach(async () => {
    await db.project.deleteMany();
    await db.asset.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("hydrates a project with 1 scene + 1 layer + 0 keyframes", async () => {
    const created = await db.project.create({
      data: {
        name: "Test Project",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: {
          create: [
            {
              order: 0,
              durationFrames: 300,
              transitionIn: Prisma.JsonNull,
              layers: {
                create: [
                  {
                    order: 0,
                    name: "Background",
                    html: "<div>Hello</div>",
                    css: "div { color: red; }",
                    startFrame: 0,
                    endFrame: 300,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const result = await toProjectJson(created.id);

    // Should parse without throwing
    const parsed = ProjectSchema.parse(result);

    expect(parsed.id).toBe(created.id);
    expect(parsed.name).toBe("Test Project");
    expect(parsed.width).toBe(1920);
    expect(parsed.height).toBe(1080);
    expect(parsed.fps).toBe(30);
    expect(parsed.scenes).toHaveLength(1);

    const scene = parsed.scenes[0];
    expect(scene.order).toBe(0);
    expect(scene.durationFrames).toBe(300);
    expect(scene.transitionIn).toBeNull();
    expect(scene.layers).toHaveLength(1);
    expect(scene.audioTracks).toHaveLength(0);

    const layer = scene.layers[0];
    expect(layer.order).toBe(0);
    expect(layer.name).toBe("Background");
    expect(layer.html).toBe("<div>Hello</div>");
    expect(layer.css).toBe("div { color: red; }");
    expect(layer.startFrame).toBe(0);
    expect(layer.endFrame).toBe(300);
    expect(layer.keyframes).toHaveLength(0);
  });

  it("populates assetSha256 on audio tracks from the asset's sha256", async () => {
    const asset = await db.asset.create({
      data: {
        type: "audio",
        filename: "track.mp3",
        path: "/assets/track.mp3",
        mimeType: "audio/mpeg",
        size: 1024,
        sha256:
          "deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
      },
    });

    const created = await db.project.create({
      data: {
        name: "Audio Project",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: {
          create: [
            {
              order: 0,
              durationFrames: 60,
              transitionIn: Prisma.JsonNull,
              audioTracks: {
                create: [
                  {
                    assetId: asset.id,
                    startFrame: 0,
                    trimStart: 0,
                    trimEnd: 60,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const result = await toProjectJson(created.id);
    const scene = result.scenes[0];
    expect(scene.audioTracks).toHaveLength(1);
    expect(scene.audioTracks[0].assetSha256).toBe(
      "deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
    );
  });

  it("hydrates a project with 2 scenes, 2 layers each, including 1 keyframe", async () => {
    const created = await db.project.create({
      data: {
        name: "Multi Scene Project",
        width: 1280,
        height: 720,
        fps: 24,
        scenes: {
          create: [
            {
              order: 0,
              durationFrames: 120,
              transitionIn: Prisma.JsonNull,
              layers: {
                create: [
                  {
                    order: 0,
                    name: "Layer A",
                    html: "<p>A</p>",
                    css: "p { color: blue; }",
                    startFrame: 0,
                    endFrame: 120,
                    keyframes: {
                      create: [
                        {
                          frame: 10,
                          property: "opacity",
                          value: "0.5",
                          easingOut: { type: "linear" },
                        },
                      ],
                    },
                  },
                  {
                    order: 1,
                    name: "Layer B",
                    html: "<p>B</p>",
                    css: "p { color: green; }",
                    startFrame: 0,
                    endFrame: 120,
                  },
                ],
              },
            },
            {
              order: 1,
              durationFrames: 60,
              transitionIn: Prisma.JsonNull,
              layers: {
                create: [
                  {
                    order: 0,
                    name: "Layer C",
                    html: "<p>C</p>",
                    css: "",
                    startFrame: 0,
                    endFrame: 60,
                  },
                  {
                    order: 1,
                    name: "Layer D",
                    html: "<p>D</p>",
                    css: "",
                    startFrame: 0,
                    endFrame: 60,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const result = await toProjectJson(created.id);
    const parsed = ProjectSchema.parse(result);

    expect(parsed.id).toBe(created.id);
    expect(parsed.fps).toBe(24);
    expect(parsed.scenes).toHaveLength(2);

    // Scene 0 — ordered first
    const scene0 = parsed.scenes.find((s) => s.order === 0)!;
    expect(scene0.layers).toHaveLength(2);
    const layerA = scene0.layers.find((l) => l.name === "Layer A")!;
    expect(layerA.keyframes).toHaveLength(1);
    expect(layerA.keyframes[0].frame).toBe(10);
    expect(layerA.keyframes[0].property).toBe("opacity");
    expect(layerA.keyframes[0].value).toBe("0.5");
    expect(layerA.keyframes[0].easingOut).toEqual({ type: "linear" });

    // Scene 1
    const scene1 = parsed.scenes.find((s) => s.order === 1)!;
    expect(scene1.durationFrames).toBe(60);
    expect(scene1.layers).toHaveLength(2);
  });

  it("hydrates layer with type 'html' when type is explicitly set", async () => {
    const created = await db.project.create({
      data: {
        name: "HTML Type Project",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: {
          create: [
            {
              order: 0,
              durationFrames: 60,
              transitionIn: Prisma.JsonNull,
              layers: {
                create: [
                  {
                    order: 0,
                    name: "HTML Layer",
                    html: "<div>hello</div>",
                    css: "",
                    startFrame: 0,
                    endFrame: 60,
                    type: "html",
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const result = await toProjectJson(created.id);
    const layer = result.scenes[0].layers[0];

    expect(layer.type).toBe("html");
    // subtitle field must not be present on an html layer
    expect("subtitle" in layer).toBe(false);
  });

  it("hydrates layer with type 'html' fallback (legacy path: type omitted from mapped object)", async () => {
    // The DB column is NOT NULL DEFAULT 'html', so we cannot inject NULL via SQL.
    // Instead, we verify the z.preprocess behaviour at the schema level:
    // passing an object without `type` through LayerSchema should produce type === "html".
    // This mirrors what would happen when toProjectJson maps a legacy row that was
    // stored before the `type` column existed.
    const { LayerSchema } = await import("@open-effects/shared-types");

    const legacyLayerInput = {
      id: "layer-legacy-001",
      order: 0,
      name: "Legacy Layer",
      html: "<div>legacy</div>",
      css: "",
      startFrame: 0,
      endFrame: 60,
      visible: true,
      keyframes: [],
      // deliberately omit `type`
    };

    const parsed = LayerSchema.parse(legacyLayerInput);

    // z.preprocess coerces missing `type` to "html"
    expect(parsed.type).toBe("html");
    expect("subtitle" in parsed).toBe(false);
  });

  it("hydrates subtitle layer with type 'subtitle' and subtitle data", async () => {
    const created = await db.project.create({
      data: {
        name: "Subtitle Layer Project",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: {
          create: [
            {
              order: 0,
              durationFrames: 300,
              transitionIn: Prisma.JsonNull,
              layers: {
                create: [
                  {
                    order: 0,
                    name: "Subtitle Layer",
                    html: "<div class='subtitle-container'></div>",
                    css: ".subtitle-container { color: white; }",
                    startFrame: 0,
                    endFrame: 300,
                    type: "subtitle",
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const subtitleData = {
      linkedAudioTrackId: "track-abc-123",
      transcript: {
        language: "en",
        model: "small",
        generatedAt: "2026-01-01T00:00:00.000Z",
        segments: [
          {
            id: "seg-001",
            text: "Hello world",
            startFrame: 0,
            endFrame: 90,
            words: [
              { text: "Hello", startFrame: 0, endFrame: 45 },
              { text: "world", startFrame: 45, endFrame: 90 },
            ],
          },
        ],
      },
      presetKey: "subtitle-fade-segment",
      manualOverride: false,
    };

    // Update the layer with subtitleData
    const scene = await db.scene.findFirstOrThrow({
      where: { projectId: created.id },
    });
    await db.layer.updateMany({
      where: { sceneId: scene.id },
      data: { subtitleData: subtitleData as Prisma.InputJsonValue },
    });

    const result = await toProjectJson(created.id);
    const layer = result.scenes[0].layers[0];

    expect(layer.type).toBe("subtitle");
    if (layer.type === "subtitle") {
      expect(layer.subtitle.linkedAudioTrackId).toBe("track-abc-123");
      // Legacy preset key was migrated to the new short-form key on read.
      expect(layer.subtitle.presetKey).toBe("subtitle-fade");
      expect(layer.subtitle.manualOverride).toBe(false);
      expect(layer.subtitle.transcript.language).toBe("en");
      expect(layer.subtitle.transcript.segments).toHaveLength(1);
      expect(layer.subtitle.transcript.segments[0].text).toBe("Hello world");
      // Legacy `words` field is silently dropped by the schema strip policy.
      expect(
        (layer.subtitle.transcript.segments[0] as Record<string, unknown>)
          .words,
      ).toBeUndefined();
    }
  });

  it("migrates legacy subtitle rows: moves preset-shaped CSS from layer.css into subtitle.presetCss", async () => {
    // Simulate a row written before the user/preset CSS split: the auto-
    // generated preset stylesheet (with @keyframes subtitle-*) lived in
    // layer.css and subtitleData had no presetCss field.
    const legacyPresetCss =
      ".subtitle-container { position: absolute; }\n" +
      "@keyframes subtitle-show-0 { from { opacity: 0; } to { opacity: 1; } }";

    const created = await db.project.create({
      data: {
        name: "Legacy Subtitle Project",
        width: 1920,
        height: 1080,
        fps: 30,
        scenes: {
          create: [
            {
              order: 0,
              durationFrames: 300,
              transitionIn: Prisma.JsonNull,
              layers: {
                create: [
                  {
                    order: 0,
                    name: "Legacy Subtitle",
                    html: "<div class='subtitle-container'></div>",
                    css: legacyPresetCss,
                    startFrame: 0,
                    endFrame: 300,
                    type: "subtitle",
                    subtitleData: {
                      linkedAudioTrackId: "track-legacy",
                      transcript: { segments: [] },
                      presetKey: "subtitle-fade-segment",
                      manualOverride: false,
                      // NOTE: no presetCss field — this is the legacy shape
                    } as Prisma.InputJsonValue,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const result = await toProjectJson(created.id);
    const layer = result.scenes[0].layers[0];

    expect(layer.type).toBe("subtitle");
    if (layer.type === "subtitle") {
      // The preset-shaped CSS moved into subtitle.presetCss...
      expect(layer.subtitle.presetCss).toBe(legacyPresetCss);
      // ...and layer.css is now empty so the user can start their own overrides
      expect(layer.css).toBe("");
    }
  });
});
