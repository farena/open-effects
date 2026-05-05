import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock toProjectJson before imports that use it
vi.mock("@/lib/persistence/toProjectJson", () => ({
  toProjectJson: vi.fn(),
}));

// Mock processEq to return the input path unchanged
vi.mock("@/lib/audio/processEq", () => ({
  processEq: vi.fn(
    async ({ inputAbsPath }: { inputAbsPath: string }) => inputAbsPath,
  ),
}));

// Mock assetResolver to return a predictable absolute path
vi.mock("@/lib/render/assetResolver", () => ({
  resolveAssetForRender: vi.fn(
    (p: string) => `/abs/public${p.replace(/^\/assets/, "/assets")}`,
  ),
}));

import { buildRenderProject } from "@/lib/render/buildRenderProject";
import { toProjectJson } from "@/lib/persistence/toProjectJson";
import { processEq } from "@/lib/audio/processEq";
import { resolveAssetForRender } from "@/lib/render/assetResolver";
import type { Project } from "@open-effects/shared-types";

const toProjectJsonMock = vi.mocked(toProjectJson);
const processEqMock = vi.mocked(processEq);
const resolveAssetMock = vi.mocked(resolveAssetForRender);

function makeFixtureProject(overrides?: Partial<Project>): Project {
  return {
    id: "proj-1",
    name: "Test Project",
    width: 1920,
    height: 1080,
    fps: 30,
    scenes: [
      {
        id: "sc-1",
        order: 0,
        name: "Scene 1",
        background: "#000000",
        durationFrames: 60,
        keyframes: [],
        layers: [],
        audioTracks: [
          {
            id: "at-1",
            assetId: "asset-1",
            assetPath: "/assets/track.mp3",
            assetSha256: "sha256abc",
            startFrame: 0,
            trimStart: 0,
            trimEnd: 60,
            volumeKeyframes: [],
          },
        ],
      },
      {
        id: "sc-2",
        order: 1,
        name: "Scene 2",
        background: "#000000",
        durationFrames: 90,
        keyframes: [],
        layers: [],
        audioTracks: [],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  processEqMock.mockImplementation(async ({ inputAbsPath }) => inputAbsPath);
  resolveAssetMock.mockImplementation(
    (p: string) => `/abs/public${p.replace(/^\/assets/, "/assets")}`,
  );
});

describe("buildRenderProject", () => {
  it("calls toProjectJson and returns { project, totalDurationFrames }", async () => {
    const fixture = makeFixtureProject();
    toProjectJsonMock.mockResolvedValueOnce(fixture);

    const result = await buildRenderProject("proj-1");

    expect(toProjectJsonMock).toHaveBeenCalledWith("proj-1");
    expect(result).toHaveProperty("project");
    expect(result).toHaveProperty("totalDurationFrames");
    expect(result.project.id).toBe("proj-1");
  });

  it("rewrites raw audio assetPath to dev-server HTTP URL when EQ is bypassed", async () => {
    const fixture = makeFixtureProject();
    toProjectJsonMock.mockResolvedValueOnce(fixture);
    resolveAssetMock.mockReturnValue("/abs/public/assets/track.mp3");
    // processEq returns the SAME path → bypass branch
    processEqMock.mockResolvedValue("/abs/public/assets/track.mp3");

    const result = await buildRenderProject("proj-1");

    const track = result.project.scenes[0].audioTracks[0];
    expect(track.assetPath).toBe("http://localhost:3000/assets/track.mp3");
  });

  it("rewrites EQ-processed audio assetPath to the eq-asset proxy route", async () => {
    const fixture = makeFixtureProject();
    toProjectJsonMock.mockResolvedValueOnce(fixture);
    resolveAssetMock.mockReturnValue("/abs/public/assets/track.mp3");
    // processEq returns a DIFFERENT path → EQ branch
    processEqMock.mockResolvedValue("/abs/cache/audio/eq-key-123.mp3");

    const result = await buildRenderProject("proj-1");

    const track = result.project.scenes[0].audioTracks[0];
    expect(track.assetPath).toBe(
      "http://localhost:3000/api/render/eq-asset/eq-key-123.mp3",
    );
  });

  it("totalDurationFrames equals the sum of scene.durationFrames", async () => {
    const fixture = makeFixtureProject();
    toProjectJsonMock.mockResolvedValueOnce(fixture);

    const result = await buildRenderProject("proj-1");

    // scene 1 = 60 frames, scene 2 = 90 frames
    expect(result.totalDurationFrames).toBe(150);
  });

  it("propagates an error when toProjectJson throws (project not found)", async () => {
    toProjectJsonMock.mockRejectedValueOnce(new Error("project not found"));

    await expect(buildRenderProject("nonexistent")).rejects.toThrow(
      "project not found",
    );
  });

  it("calls processEq with inputAbsPath and assetSha256 for each audio track", async () => {
    const fixture = makeFixtureProject();
    toProjectJsonMock.mockResolvedValueOnce(fixture);
    resolveAssetMock.mockReturnValue("/abs/public/assets/track.mp3");
    processEqMock.mockResolvedValue("/abs/public/assets/track.mp3");

    await buildRenderProject("proj-1");

    expect(processEqMock).toHaveBeenCalledWith({
      inputAbsPath: "/abs/public/assets/track.mp3",
      assetSha256: "sha256abc",
      eq: null,
    });
  });

  it("handles a project with no audio tracks (no processEq calls)", async () => {
    const fixture = makeFixtureProject({
      scenes: [
        {
          id: "sc-1",
          order: 0,
          name: "Scene 1",
          background: "#000000",
          durationFrames: 30,
          keyframes: [],
          layers: [],
          audioTracks: [],
        },
      ],
    });
    toProjectJsonMock.mockResolvedValueOnce(fixture);

    const result = await buildRenderProject("proj-1");

    expect(processEqMock).not.toHaveBeenCalled();
    expect(result.totalDurationFrames).toBe(30);
  });
});
