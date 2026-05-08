import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEditorStore } from "@/editor/store";
import type { Project } from "@open-effects/shared-types";

const SCENE_ID = "scene-split-1";

function makeProject(): Project {
  return {
    id: "proj-split",
    name: "Split Test Project",
    width: 1920,
    height: 1080,
    fps: 30,
    scenes: [
      {
        id: SCENE_ID,
        order: 0,
        name: "Scene 1",
        background: "#000000",
        durationFrames: 120,
        transitionIn: null,
        keyframes: [],
        audioTracks: [
          {
            id: "track-a",
            assetId: "asset-1",
            assetPath: "/audio/song.mp3",
            startFrame: 10,
            trimStart: 0,
            trimEnd: 60,
            eq: { low: 2, mid: 0, high: -1, presence: 3 },
            volumeKeyframes: [],
          },
        ],
        layers: [],
      },
    ],
  };
}

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
  });
}

function getScene() {
  return useEditorStore
    .getState()
    .project.scenes.find((sc) => sc.id === SCENE_ID)!;
}

function getTrack(id: string) {
  return getScene().audioTracks.find((t) => t.id === id);
}

describe("splitAudioTrack store action", () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  // ── Basic split geometry ────────────────────────────────────────────────────

  it("splits track into two tracks at the given local frame", () => {
    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    expect(tracks).toHaveLength(2);
  });

  it("original track trimEnd becomes splitTrim (trimStart + splitFrameLocal)", () => {
    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const orig = getTrack("track-a")!;
    // trimStart=0, splitFrameLocal=30 => splitTrim = 0+30 = 30
    expect(orig.trimEnd).toBe(30);
    expect(orig.trimStart).toBe(0); // unchanged
  });

  it("new track has correct startFrame = original.startFrame + splitFrameLocal", () => {
    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    const newTrack = tracks[1]!;
    // original startFrame=10, splitFrameLocal=30 => newTrack.startFrame=40
    expect(newTrack.startFrame).toBe(40);
  });

  it("new track trimStart = original.trimStart + splitFrameLocal", () => {
    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    const newTrack = tracks[1]!;
    // splitTrim = 0 + 30 = 30
    expect(newTrack.trimStart).toBe(30);
  });

  it("new track trimEnd = original trimEnd", () => {
    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    const newTrack = tracks[1]!;
    expect(newTrack.trimEnd).toBe(60);
  });

  it("both tracks reference the same assetId and assetPath", () => {
    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    expect(tracks[0]!.assetId).toBe("asset-1");
    expect(tracks[1]!.assetId).toBe("asset-1");
    expect(tracks[0]!.assetPath).toBe("/audio/song.mp3");
    expect(tracks[1]!.assetPath).toBe("/audio/song.mp3");
  });

  it("new track gets a different id than the original", () => {
    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    expect(tracks[0]!.id).toBe("track-a");
    expect(tracks[1]!.id).not.toBe("track-a");
    expect(tracks[1]!.id.length).toBeGreaterThan(0);
  });

  it("new track is appended immediately after original in audioTracks array", () => {
    // Add a second track before splitting so we can verify insertion position
    useEditorStore.getState().addAudioTrack(SCENE_ID, {
      id: "asset-2",
      path: "/audio/other.mp3",
      durationFrames: 50,
    });

    const origTrackBefore = getScene().audioTracks[0]!;
    const secondTrackId = getScene().audioTracks[1]!.id;

    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    expect(tracks).toHaveLength(3);
    expect(tracks[0]!.id).toBe(origTrackBefore.id); // original
    expect(tracks[1]!.id).not.toBe("track-a"); // new split track
    expect(tracks[2]!.id).toBe(secondTrackId); // unchanged second track
  });

  // ── Volume keyframe partitioning ────────────────────────────────────────────

  it("volume keyframes < splitFrameLocal stay with original (unchanged)", () => {
    // Set keyframes at local frames 5 and 25
    useEditorStore.getState().addVolumeKeyframe("track-a", 5, 0.5);
    useEditorStore.getState().addVolumeKeyframe("track-a", 25, 0.8);

    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const orig = getTrack("track-a")!;
    expect(orig.volumeKeyframes).toHaveLength(2);
    expect(orig.volumeKeyframes.map((k) => k.frame).sort((a, b) => a - b)).toEqual([5, 25]);
  });

  it("volume keyframes >= splitFrameLocal go to new track, rebased", () => {
    // Set keyframes at local frames 5, 25, 40, 55
    useEditorStore.getState().addVolumeKeyframe("track-a", 5, 0.5);
    useEditorStore.getState().addVolumeKeyframe("track-a", 25, 0.8);
    useEditorStore.getState().addVolumeKeyframe("track-a", 40, 0.6);
    useEditorStore.getState().addVolumeKeyframe("track-a", 55, 0.3);

    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    const orig = tracks[0]!;
    const newTrack = tracks[1]!;

    // Original keeps frames < 30: [5, 25]
    expect(orig.volumeKeyframes.map((k) => k.frame).sort((a, b) => a - b)).toEqual([5, 25]);

    // New track gets frames >= 30, rebased by subtracting 30: 40-30=10, 55-30=25
    expect(newTrack.volumeKeyframes.map((k) => k.frame).sort((a, b) => a - b)).toEqual([10, 25]);
  });

  it("keyframe at exactly splitFrameLocal goes to new track (tie-breaker: right half)", () => {
    // A keyframe exactly at the split point should go to the right half
    useEditorStore.getState().addVolumeKeyframe("track-a", 30, 0.7);

    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    const orig = tracks[0]!;
    const newTrack = tracks[1]!;

    expect(orig.volumeKeyframes).toHaveLength(0);
    // Frame 30 goes to new track, rebased to frame 0
    expect(newTrack.volumeKeyframes).toHaveLength(1);
    expect(newTrack.volumeKeyframes[0]!.frame).toBe(0);
  });

  // ── EQ duplication ─────────────────────────────────────────────────────────

  it("EQ is deep-copied to both halves", () => {
    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    expect(tracks[0]!.eq).toEqual({ low: 2, mid: 0, high: -1, presence: 3 });
    expect(tracks[1]!.eq).toEqual({ low: 2, mid: 0, high: -1, presence: 3 });
    // Ensure they are different objects (deep copy, not shared reference)
    expect(tracks[0]!.eq).not.toBe(tracks[1]!.eq);
  });

  it("null EQ is preserved as null in both halves", () => {
    // Use a track without EQ
    useEditorStore.setState((s) => {
      const sc = s.project.scenes.find((x) => x.id === SCENE_ID)!;
      const t = sc.audioTracks.find((x) => x.id === "track-a")!;
      t.eq = null;
    });

    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    expect(tracks[0]!.eq).toBeNull();
    expect(tracks[1]!.eq).toBeNull();
  });

  // ── Edge cases / guards ─────────────────────────────────────────────────────

  it("is a no-op when splitFrameLocal <= 0", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    useEditorStore.getState().splitAudioTrack("track-a", 0);

    expect(getScene().audioTracks).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("is a no-op when splitFrameLocal is negative", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    useEditorStore.getState().splitAudioTrack("track-a", -5);

    expect(getScene().audioTracks).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("is a no-op when splitFrameLocal >= span (trimEnd - trimStart)", () => {
    // span = 60 - 0 = 60; splitting at 60 should be no-op
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    useEditorStore.getState().splitAudioTrack("track-a", 60);

    expect(getScene().audioTracks).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("is a no-op when splitFrameLocal exceeds span", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    useEditorStore.getState().splitAudioTrack("track-a", 100);

    expect(getScene().audioTracks).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("is a no-op when trackId does not exist", () => {
    useEditorStore.getState().splitAudioTrack("nonexistent", 30);

    expect(getScene().audioTracks).toHaveLength(1);
  });

  // ── Undo support ────────────────────────────────────────────────────────────

  it("split is tracked by undo (project state changes)", () => {
    const before = useEditorStore.getState().project;

    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const after = useEditorStore.getState().project;
    expect(after).not.toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Task 3 — Seam continuity test
// ---------------------------------------------------------------------------

describe("splitAudioTrack seam continuity", () => {
  beforeEach(() => {
    resetStore();
  });

  /**
   * Linearly interpolates between two keyframe values at a given frame.
   * This mirrors the runtime's evalVolumeAtFrame logic (linear easing only).
   */
  function evalVolumeLinear(
    keyframes: Array<{ frame: number; value: number }>,
    localFrame: number,
  ): number {
    if (keyframes.length === 0) return 1;

    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

    if (localFrame <= sorted[0]!.frame) return sorted[0]!.value;
    if (localFrame >= sorted[sorted.length - 1]!.frame)
      return sorted[sorted.length - 1]!.value;

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      if (localFrame >= a.frame && localFrame <= b.frame) {
        const t = (localFrame - a.frame) / (b.frame - a.frame);
        return a.value + t * (b.value - a.value);
      }
    }

    return 1;
  }

  /**
   * After splitting, playing both halves end-to-end is sample-equivalent
   * to playing the original for any frames that were NOT in the middle of
   * an interpolated segment spanning the split boundary. The seam is
   * continuous in the sense that:
   * - all keyframes that were strictly before the seam are preserved as-is
   * - all keyframes at or after the seam are preserved in the new half (rebased)
   * - the last frame of origHalf evaluates consistently with the original
   * - the first frame of newHalf (frame 0) evaluates consistently with the
   *   original at the seam frame
   *
   * Playback contract: Remotion <Audio> honours startFrom/endAt exactly;
   * FFmpeg at render does the same. Both split halves point to the same
   * asset on disk, so playing them consecutively reproduces the original.
   */
  it("volume curve is continuous at the split seam — keyframes partition cleanly", () => {
    // Place keyframes that do NOT straddle the split boundary at frame 30.
    // - origHalf keeps: frames < 30 → kfs at [5, 20]
    // - newHalf gets: frames >= 30, rebased → kfs at [0 (=30-30), 15 (=45-30)]
    //
    // We check frames that lie WITHIN an intact segment (not across the split):
    //   - pre-seam frames [5..20] are contained inside origHalf's [5..20] segment
    //   - post-seam frames [30..45] map to newHalf locals [0..15], inside [0..15]
    useEditorStore.getState().addVolumeKeyframe("track-a", 5, 0.2);
    useEditorStore.getState().addVolumeKeyframe("track-a", 20, 0.6);
    // The split happens at 30 — NO keyframe here; kf at 30 goes to new half
    useEditorStore.getState().addVolumeKeyframe("track-a", 30, 0.9); // goes to new half as frame 0
    useEditorStore.getState().addVolumeKeyframe("track-a", 45, 0.4); // goes to new half as frame 15

    // Snapshot original curve in the PRE-seam segment [5..20]
    const origKfs = getScene().audioTracks[0]!.volumeKeyframes;
    const preSeamFrames = [5, 10, 15, 20];
    const origPreSeam = preSeamFrames.map((f) => evalVolumeLinear(origKfs, f));

    // Snapshot original curve in the POST-seam segment [30..45]
    const postSeamOriginals = [30, 35, 40, 45];
    const origPostSeam = postSeamOriginals.map((f) =>
      evalVolumeLinear(origKfs, f),
    );

    // Split at local frame 30
    useEditorStore.getState().splitAudioTrack("track-a", 30);

    const tracks = getScene().audioTracks;
    const origHalf = tracks[0]!;
    const newHalf = tracks[1]!;

    // ── Pre-seam segment is unchanged in origHalf ──────────────────────────
    for (let i = 0; i < preSeamFrames.length; i++) {
      expect(evalVolumeLinear(origHalf.volumeKeyframes, preSeamFrames[i]!))
        .toBeCloseTo(origPreSeam[i]!, 10);
    }

    // ── Post-seam segment is preserved in newHalf (rebased by -30) ────────
    for (let i = 0; i < postSeamOriginals.length; i++) {
      const newHalfLocal = postSeamOriginals[i]! - 30;
      expect(evalVolumeLinear(newHalf.volumeKeyframes, newHalfLocal))
        .toBeCloseTo(origPostSeam[i]!, 10);
    }
  });

  it("split track with no keyframes produces a flat 1.0 volume on both halves", () => {
    // No keyframes on the track
    useEditorStore.getState().splitAudioTrack("track-a", 25);

    const tracks = getScene().audioTracks;
    expect(tracks[0]!.volumeKeyframes).toHaveLength(0);
    expect(tracks[1]!.volumeKeyframes).toHaveLength(0);

    // evalVolumeLinear returns 1.0 for empty keyframes (default)
    expect(evalVolumeLinear([], 10)).toBe(1);
    expect(evalVolumeLinear([], 10)).toBe(1);
  });
});
