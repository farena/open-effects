/**
 * End-to-end integration test: transcribeAudioTrack → subtitle layer creation
 * and subsequent regeneration via updateSubtitleTranscript + regenerateSubtitleLayer.
 *
 * This test does NOT hit the real API or Whisper service — fetch is fully mocked.
 * It validates that all store actions are correctly wired together end-to-end.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project, SubtitleLayer } from "@open-effects/shared-types";
import type { TranscriptJob } from "@/lib/transcript/types";
import fixture from "../fixtures/transcript-3segments.json";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENE_ID = "scene-e2e-1";
const TRACK_ID = "track-e2e-1";
const PROJECT_ID = "proj-e2e-1";
const JOB_ID = "test-1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeProject = (): Project => ({
  id: PROJECT_ID,
  name: "E2E Transcript Test Project",
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
          assetId: "asset-e2e-1",
          assetPath: "/uploads/e2e-test.mp3",
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

function makeSse(events: TranscriptJob[]): Response {
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

function getSubtitleLayer(layerId: string): SubtitleLayer {
  const state = useEditorStore.getState();
  for (const sc of state.project.scenes) {
    const l = sc.layers.find((x) => x.id === layerId);
    if (l && l.type === "subtitle") return l as SubtitleLayer;
  }
  throw new Error(`Subtitle layer ${layerId} not found`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("transcript end-to-end: transcribeAudioTrack → subtitle layer → regenerate", () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  it("creates one subtitle layer with correct transcript, preset and html segments, then regenerates after transcript mutation", async () => {
    // ── Step 1: Set up mock fetch ──────────────────────────────────────────

    const sseEvents: TranscriptJob[] = [
      {
        id: JOB_ID,
        projectId: PROJECT_ID,
        trackId: TRACK_ID,
        status: "queued",
        progress: 0,
        startedAt: Date.now(),
      },
      {
        id: JOB_ID,
        projectId: PROJECT_ID,
        trackId: TRACK_ID,
        status: "transcribing",
        progress: 0.5,
        startedAt: Date.now(),
      },
      {
        id: JOB_ID,
        projectId: PROJECT_ID,
        trackId: TRACK_ID,
        status: "completed",
        progress: 1,
        transcript: fixture,
        startedAt: Date.now(),
        finishedAt: Date.now(),
      },
    ];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);

      if (url.includes("/transcript/events")) {
        return makeSse(sseEvents);
      }
      // POST /api/projects/.../transcript
      return new Response(JSON.stringify({ jobId: JOB_ID }), { status: 202 });
    });

    // ── Step 2: Run transcribeAudioTrack ───────────────────────────────────

    await useEditorStore.getState().transcribeAudioTrack(TRACK_ID);

    // ── Step 3: Assert subtitle layer was created ──────────────────────────

    const stateAfterTranscribe = useEditorStore.getState();
    const scene = stateAfterTranscribe.project.scenes.find(
      (s) => s.id === SCENE_ID,
    )!;

    // Exactly one layer must have been added
    expect(scene.layers).toHaveLength(1);

    const layer = scene.layers[0]!;

    // Layer type must be subtitle
    expect(layer.type).toBe("subtitle");

    if (layer.type !== "subtitle") {
      throw new Error("Layer type assertion failed — unreachable");
    }

    // subtitle.transcript must deep-equal the fixture
    expect(layer.subtitle.transcript).toEqual(fixture);

    // subtitle.presetKey must be the default
    expect(layer.subtitle.presetKey).toBe("subtitle-fade");

    // html must contain exactly 3 subtitle-segment divs (one per fixture segment)
    const segmentMatches = layer.html.match(/<div class="subtitle-segment"/g);
    expect(segmentMatches).not.toBeNull();
    expect(segmentMatches!.length).toBe(3);

    // selectedLayerId must point to the new layer
    expect(stateAfterTranscribe.selectedLayerId).toBe(layer.id);

    // ── Step 4: Mutate transcript and regenerate ───────────────────────────

    const layerId = layer.id;

    const modifiedTranscript = {
      ...fixture,
      segments: fixture.segments.map((seg, i) =>
        i === 0 ? { ...seg, text: "Texto modificado." } : seg,
      ),
    };

    useEditorStore
      .getState()
      .updateSubtitleTranscript(layerId, modifiedTranscript);

    // After updateSubtitleTranscript: transcript is updated but html unchanged
    const layerAfterUpdate = getSubtitleLayer(layerId);
    expect(layerAfterUpdate.subtitle.transcript.segments[0]!.text).toBe(
      "Texto modificado.",
    );
    // html still reflects original text
    expect(layerAfterUpdate.html).toContain("Hola, este es un ejemplo.");

    // ── Step 5: Regenerate ─────────────────────────────────────────────────

    useEditorStore.getState().regenerateSubtitleLayer(layerId);

    const layerAfterRegen = getSubtitleLayer(layerId);

    // html must now contain the updated text
    expect(layerAfterRegen.html).toContain("Texto modificado.");

    // Original first segment text must no longer appear
    expect(layerAfterRegen.html).not.toContain("Hola, este es un ejemplo.");

    // Still has 3 subtitle-segment divs
    const regenSegmentMatches = layerAfterRegen.html.match(
      /<div class="subtitle-segment"/g,
    );
    expect(regenSegmentMatches).not.toBeNull();
    expect(regenSegmentMatches!.length).toBe(3);

    // manualOverride must be reset to false after regenerate
    expect(layerAfterRegen.subtitle.manualOverride).toBe(false);
  });
});
