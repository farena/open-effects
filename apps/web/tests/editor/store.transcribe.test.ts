import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project } from "@open-effects/shared-types";
import type { TranscriptJob } from "@/lib/transcript/types";
import transcriptFixture from "../fixtures/transcript-3segments.json";

const SCENE_ID = "scene-transcribe-1";
const TRACK_ID = "t1";
const PROJECT_ID = "proj-transcribe";

const makeProject = (): Project => ({
  id: PROJECT_ID,
  name: "Transcribe Test Project",
  width: 1920,
  height: 1080,
  fps: 30,
  css: "",
  scenes: [
    {
      id: SCENE_ID,
      order: 0,
      name: "Scene 1",
      background: "#000000",
      durationFrames: 900,
      transitionIn: null,
      keyframes: [],
      layers: [],
      audioTracks: [
        {
          id: TRACK_ID,
          assetId: "asset-1",
          assetPath: "/uploads/test.mp3",
          startFrame: 0,
          trimStart: 0,
          trimEnd: 900,
          muted: false,
          eq: null,
          volumeKeyframes: [],
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
    transcriptionStatus: {},
  });
}

function makeSseResponse(events: TranscriptJob[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

describe("transcribeAudioTrack", () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  it("happy path: status becomes completed and subtitle layer is created", async () => {
    const sseEvents: TranscriptJob[] = [
      { id: "j1", projectId: PROJECT_ID, trackId: TRACK_ID, status: "queued", progress: 0, startedAt: Date.now() },
      { id: "j1", projectId: PROJECT_ID, trackId: TRACK_ID, status: "model-loading", progress: 0.1, startedAt: Date.now() },
      { id: "j1", projectId: PROJECT_ID, trackId: TRACK_ID, status: "transcribing", progress: 0.5, startedAt: Date.now() },
      {
        id: "j1",
        projectId: PROJECT_ID,
        trackId: TRACK_ID,
        status: "completed",
        progress: 1,
        transcript: transcriptFixture,
        startedAt: Date.now(),
        finishedAt: Date.now(),
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("/transcript/events")) {
        return makeSseResponse(sseEvents);
      }
      // POST start
      return new Response(JSON.stringify({ jobId: "j1" }), { status: 202 });
    });

    await useEditorStore.getState().transcribeAudioTrack(TRACK_ID);

    const state = useEditorStore.getState();
    expect(state.transcriptionStatus[TRACK_ID]?.status).toBe("completed");

    const scene = state.project.scenes.find((s) => s.id === SCENE_ID)!;
    expect(scene.layers).toHaveLength(1);
    const layer = scene.layers[0]!;
    expect(layer.type).toBe("subtitle");

    if (layer.type === "subtitle") {
      expect(layer.subtitle.presetKey).toBe("subtitle-fade-segment");
    }

    expect(state.selectedLayerId).toBe(layer.id);
  });

  it("error from SSE: status becomes error and no layer is created", async () => {
    const sseEvents: TranscriptJob[] = [
      { id: "j1", projectId: PROJECT_ID, trackId: TRACK_ID, status: "queued", progress: 0, startedAt: Date.now() },
      {
        id: "j1",
        projectId: PROJECT_ID,
        trackId: TRACK_ID,
        status: "error",
        progress: 0,
        error: "Whisper failed",
        startedAt: Date.now(),
        finishedAt: Date.now(),
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("/transcript/events")) {
        return makeSseResponse(sseEvents);
      }
      return new Response(JSON.stringify({ jobId: "j1" }), { status: 202 });
    });

    await useEditorStore.getState().transcribeAudioTrack(TRACK_ID);

    const state = useEditorStore.getState();
    expect(state.transcriptionStatus[TRACK_ID]?.status).toBe("error");

    const scene = state.project.scenes.find((s) => s.id === SCENE_ID)!;
    expect(scene.layers).toHaveLength(0);
  });

  it("start fails (POST 500): status becomes error and no layer is created", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response("Internal Server Error", { status: 500 });
    });

    await useEditorStore.getState().transcribeAudioTrack(TRACK_ID);

    const state = useEditorStore.getState();
    expect(state.transcriptionStatus[TRACK_ID]?.status).toBe("error");
    expect(state.transcriptionStatus[TRACK_ID]?.error).toContain("500");

    const scene = state.project.scenes.find((s) => s.id === SCENE_ID)!;
    expect(scene.layers).toHaveLength(0);
  });

  it("unknown trackId: no fetch happens and nothing mutates", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await useEditorStore.getState().transcribeAudioTrack("nope");

    expect(fetchSpy).not.toHaveBeenCalled();

    const state = useEditorStore.getState();
    expect(state.transcriptionStatus["nope"]).toBeUndefined();

    const scene = state.project.scenes.find((s) => s.id === SCENE_ID)!;
    expect(scene.layers).toHaveLength(0);
  });
});
