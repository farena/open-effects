import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { persistProjectJson } from "@/lib/persistence/persistProjectJson";
import type { Project } from "@open-effects/shared-types";

describe("persistProjectJson — Layer.type and subtitleData", () => {
  let projectId: string;

  beforeEach(async () => {
    await db.project.deleteMany();

    const project = await db.project.create({
      data: {
        name: "Test Persist Project",
        width: 1920,
        height: 1080,
        fps: 30,
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("persists html layer with type='html' and subtitleData=null, and subtitle layer with type='subtitle' and subtitleData equal to the subtitle block", async () => {
    const subtitleBlock = {
      linkedAudioTrackId: "at-abc123",
      transcript: {
        language: "en",
        model: "whisper-large-v3",
        generatedAt: "2026-05-18T10:00:00.000Z",
        segments: [
          {
            id: "seg-1",
            text: "Hello world",
            startFrame: 0,
            endFrame: 30,
            words: [
              { text: "Hello", startFrame: 0, endFrame: 15 },
              { text: "world", startFrame: 15, endFrame: 30 },
            ],
          },
        ],
      },
      presetKey: "subtitle-fade-segment",
      manualOverride: false,
    };

    const project: Project = {
      id: projectId,
      name: "Test Persist Project",
      width: 1920,
      height: 1080,
      fps: 30,
      scenes: [
        {
          id: "scene-test-1",
          order: 0,
          name: "Scene 1",
          background: "#000000",
          durationFrames: 90,
          keyframes: [],
          transitionIn: null,
          layers: [
            {
              type: "html",
              id: "layer-html-1",
              order: 0,
              name: "HTML Layer",
              html: "<div>Hello</div>",
              css: "",
              startFrame: 0,
              endFrame: 90,
              visible: true,
              keyframes: [],
            },
            {
              type: "subtitle",
              id: "layer-sub-1",
              order: 1,
              name: "Subtitle Layer",
              html: "<div class='subtitle'>Hello world</div>",
              css: ".subtitle { color: white; }",
              startFrame: 0,
              endFrame: 90,
              visible: true,
              keyframes: [],
              subtitle: subtitleBlock,
            },
          ],
          audioTracks: [],
        },
      ],
    };

    await persistProjectJson(projectId, project);

    const rawLayers = await db.layer.findMany({
      where: { scene: { projectId } },
      orderBy: { order: "asc" },
    });

    expect(rawLayers).toHaveLength(2);

    const htmlLayer = rawLayers[0];
    expect(htmlLayer.id).toBe("layer-html-1");
    expect(htmlLayer.type).toBe("html");
    expect(htmlLayer.subtitleData).toBeNull();

    const subtitleLayer = rawLayers[1];
    expect(subtitleLayer.id).toBe("layer-sub-1");
    expect(subtitleLayer.type).toBe("subtitle");
    expect(subtitleLayer.subtitleData).toEqual(subtitleBlock);
  });
});
