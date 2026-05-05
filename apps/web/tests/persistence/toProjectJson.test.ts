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
});
