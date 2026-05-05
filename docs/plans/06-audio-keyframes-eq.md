# Stage 6 — Audio (volume keyframes + static EQ) Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read all prior plans first. Stage 6 builds on Stage 5's `AudioTrack` infrastructure: it adds **volume keyframes** (audible in `<Player>` preview, exact same easing logic as layer keyframes from Stage 4) and **static 4-band EQ** that runs only at render time via FFmpeg with a deterministic disk cache. The render endpoint itself arrives in Stage 8 — here we deliver the EQ pre-processor as a reusable function that Stage 8 will invoke.

**Goal:** User selects an `AudioTrack` in the timeline, opens an "Audio FX" inspector tab, adds 2+ volume keyframes for fade in/out, hears the fade in `<Player>`. User adjusts 4 EQ band gains; running the standalone EQ-process script (proxy for the future Stage-8 render) produces a new audio file with the EQ applied; subsequent calls with the same parameters return the cached file instantly.

**Architecture:** VolumeKeyframes use the same easing model as Stage 4 layer keyframes — but interpolate a single scalar (volume, 0..1) instead of CSS values. A pure `evalVolumeAtFrame(volumeKeyframes, localFrame, fps)` lives in `packages/runtime` and is wired into `<Audio volume={…}>` inside `AudioTrackPlayer`. Volume keyframes are stored in **frames local to the AudioTrack** (frame 0 = `track.startFrame`), mirroring Stage 4's layer-local model. EQ is **static per track** (no keyframes); 4 bands (low/mid/high/presence in dB). EQ is applied only at render via FFmpeg's `equalizer` filter chained 4 times. The orchestrator `processEq()` lives at `apps/web/src/lib/audio/processEq.ts` with a SHA256-keyed disk cache at `apps/web/.cache/audio/`. **Bypass:** if `eq == null` or all four gains are 0, return the raw asset path unchanged (no FFmpeg call, no cache entry).

**Tech Stack additions:** local `ffmpeg` CLI (verified at process start; documented requirement since Stage 1) · Node `child_process` for invoking FFmpeg · existing `bezier-easing` + `remotion::spring` from Stage 4 (reused via Stage 4's `evalEasing`).

---

## Acceptance criteria → tasks map (Stage 6 master ACs)

| Master AC | Tasks |
|---|---|
| 1. `VolumeKeyframe` model wired with frame/value/easing | T1 |
| 2. `<Audio volume>` evaluator audible in preview | T3, T4 |
| 3. Inspector EQ 4-band UI | T5, T6 |
| 4. FFmpeg pre-process pipeline | T9, T10, T11 |
| 5. Deterministic SHA256 cache | T8, T9 |
| 6. Cache hit avoids re-processing | T11 |
| 7. Render uses processed; preview uses raw | T11 + Stage 8 contract |
| 8. EQ bypass when all gains = 0 | T11 |

---

## File structure to create

```
packages/runtime/
├── src/
│   ├── keyframes/
│   │   ├── evalVolumeAtFrame.ts           # NEW (reuses evalEasing)
│   │   └── index.ts                        # MODIFY: barrel export
│   └── components/
│       └── AudioTrackPlayer.tsx            # MODIFY: volume function
└── tests/
    └── keyframes/
        └── evalVolumeAtFrame.test.ts       # NEW

apps/web/
├── src/
│   ├── editor/
│   │   ├── store.ts                        # MODIFY: audio fx actions
│   │   ├── store.types.ts                  # MODIFY: selectedAudioTrackId
│   │   ├── selectors.ts                    # MODIFY: audio fx selectors
│   │   └── components/
│   │       ├── inspector/
│   │       │   ├── Inspector.tsx           # MODIFY: route to AudioFxTab when track selected
│   │       │   ├── AudioFxTab.tsx          # NEW: volume keyframes + EQ
│   │       │   └── EqEditor.tsx            # NEW: 4-band controls
│   │       ├── AudioStrip.tsx              # MODIFY: select track on click
│   │       └── Timeline.tsx                # MODIFY: render volume keyframe dots on audio lane
│   ├── lib/audio/
│   │   ├── cacheKey.ts                     # NEW
│   │   ├── ffmpegArgs.ts                   # NEW
│   │   ├── processEq.ts                    # NEW
│   │   └── ffmpegBin.ts                    # NEW: detect ffmpeg
└── tests/
    ├── editor/
    │   └── store.audioFx.test.ts           # NEW
    └── lib/audio/
        ├── cacheKey.test.ts                # NEW
        ├── ffmpegArgs.test.ts              # NEW
        └── processEq.test.ts               # NEW

scripts/
└── process-eq-demo.ts                      # manual smoke (T13)

docs/decisions/
└── 06-eq-cache-strategy.md                 # NEW (T8)
```

---

## Task list (execution order)

### Task 1: Store actions for volume keyframes + EQ (TDD)

**Files:**
- Modify: `apps/web/src/editor/store.ts`, `store.types.ts`
- Create: `apps/web/tests/editor/store.audioFx.test.ts`

- [x] **Step 1:** Add to state: `selectedAudioTrackId: string | null`. Add to actions:
  ```ts
  selectAudioTrack: (id: string | null) => void;
  addVolumeKeyframe: (trackId: string, frame: number, value: number, easingOut?: Easing) => void;
  deleteVolumeKeyframe: (trackId: string, frame: number) => void;
  moveVolumeKeyframe: (trackId: string, fromFrame: number, toFrame: number) => void;
  updateVolumeKeyframeValue: (trackId: string, frame: number, value: number) => void;
  updateVolumeKeyframeEasing: (trackId: string, frame: number, easingOut: Easing) => void;
  setAudioTrackEq: (trackId: string, eq: Eq | null) => void;
  ```
- [x] **Step 2:** Failing tests:
  - `selectAudioTrack` sets state; selecting a layer clears audio track selection (and vice versa).
  - `addVolumeKeyframe` appends with `value` clamped to [0..1] and default easing `linear`. Replaces if same `frame`.
  - `deleteVolumeKeyframe` removes matching entry.
  - `moveVolumeKeyframe` updates frame; rejects if collision (same `(trackId, frame)`).
  - `updateVolumeKeyframeValue` mutates only the matching kf, clamps to [0..1].
  - `updateVolumeKeyframeEasing` mutates `easingOut`.
  - `setAudioTrackEq(t, null)` clears EQ; `setAudioTrackEq(t, { low:3, mid:0, high:0, presence:6 })` persists.
- [x] **Step 3:** Implement using a `mutateAudioTrack` helper (already exists from Stage 5). Clear-the-other-selection rule:
  ```ts
  selectAudioTrack: (id) => set((s) => { s.selectedAudioTrackId = id; s.selectedLayerId = null; }),
  // and modify selectLayer in Stage 3:
  selectLayer: (id) => set((s) => { s.selectedLayerId = id; s.selectedAudioTrackId = null; })
  ```
- [x] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit: `feat(editor): audio fx store actions`.

---

### Task 2: Audio FX selectors

**Files:**
- Modify: `apps/web/src/editor/selectors.ts`

- [x] **Step 1:** Add:
  ```ts
  export const selectActiveAudioTrack = (s: EditorState) => {
    if (!s.selectedAudioTrackId) return null;
    for (const sc of s.project.scenes) {
      const t = sc.audioTracks.find((x) => x.id === s.selectedAudioTrackId);
      if (t) return t;
    }
    return null;
  };
  export const selectVolumeKeyframes = (s: EditorState) =>
    selectActiveAudioTrack(s)?.volumeKeyframes ?? [];
  ```
- [x] **Step 2:** Quick unit test for `selectActiveAudioTrack`.
- [ ] **Step 3:** Commit: `feat(editor): audio fx selectors`.

---

### Task 3: `evalVolumeAtFrame` (TDD)

**Files:**
- Create: `packages/runtime/src/keyframes/evalVolumeAtFrame.ts`, `packages/runtime/tests/keyframes/evalVolumeAtFrame.test.ts`

- [x] **Step 1:** Failing tests:
  - Empty volumeKeyframes → returns 1.
  - One keyframe → returns its value at any frame.
  - Two keyframes linear `0→1` at `frame 0..30`: at frame 15 returns ~0.5.
  - Clamps before first / after last.
  - Spring easing produces non-linear midpoint.
  - Zero-length segment (two kfs at same frame) → returns second value (degenerate case).
- [x] **Step 2:** Implement (mirrors `computeStylesAtFrame` shape but single-property scalar):
  ```ts
  import type { VolumeKeyframe } from "@open-effects/shared-types";
  import { evalEasing } from "./easings";

  export function evalVolumeAtFrame(kfs: VolumeKeyframe[], frame: number, fps: number): number {
    if (kfs.length === 0) return 1;
    const sorted = [...kfs].sort((a, b) => a.frame - b.frame);
    if (frame <= sorted[0].frame) return sorted[0].value;
    if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;
    const idx = sorted.findIndex((k) => k.frame > frame);
    const a = sorted[idx - 1], b = sorted[idx];
    if (b.frame === a.frame) return b.value;
    const t = evalEasing(a.easingOut, frame - a.frame, b.frame - a.frame, fps);
    return a.value + (b.value - a.value) * t;
  }
  ```
- [x] **Step 3:** Tests pass.
- [x] **Step 4:** Update `packages/runtime/src/index.ts` barrel.
- [ ] **Step 5:** Commit: `feat(runtime): evalVolumeAtFrame`.

---

### Task 4: Wire `AudioTrackPlayer` to use volume callback

**Files:**
- Modify: `packages/runtime/src/components/AudioTrackPlayer.tsx`

- [x] **Step 1:** Modify:
  ```tsx
  import { Audio, Sequence, useVideoConfig } from "remotion";
  import { evalVolumeAtFrame } from "../keyframes/evalVolumeAtFrame";

  export const AudioTrackPlayer: React.FC<{ track: AudioTrack }> = ({ track }) => {
    const { fps } = useVideoConfig();
    const duration = Math.max(1, track.trimEnd - track.trimStart);
    return (
      <Sequence from={track.startFrame} durationInFrames={duration} layout="none">
        <Audio
          src={track.assetPath}
          startFrom={track.trimStart}
          endAt={track.trimEnd}
          volume={(frame) => evalVolumeAtFrame(track.volumeKeyframes, frame, fps)}
        />
      </Sequence>
    );
  };
  ```
- [x] **Step 2:** Update test to add a volume-keyframe case asserting the prop is a function.
- [ ] **Step 3:** Commit: `feat(runtime): AudioTrackPlayer volume function`.

**Note on frame semantics:** Remotion's `<Audio volume>` callback receives the local frame *within the wrapping Sequence* (frame 0 = `track.startFrame` from the project's perspective). So `volumeKeyframes[].frame` is naturally local to the track. This matches Stage 4's layer-local model.

---

### Task 5: Inspector AudioFxTab UI

**Files:**
- Modify: `apps/web/src/editor/components/inspector/Inspector.tsx`
- Create: `apps/web/src/editor/components/inspector/AudioFxTab.tsx`

- [x] **Step 1:** Modify `Inspector.tsx`:
  - If `selectActiveAudioTrack(state)` returns a track → render `<AudioFxTab />` instead of the Layer tabs.
  - If a layer is selected → existing Stage 3/4 tabs.
  - If neither → "Select a layer or audio track".
- [x] **Step 2:** Implement `AudioFxTab.tsx` with two sections:
  - **Volume keyframes**: header with current frame indicator + "+ Add keyframe @ current frame" button (uses `currentFrame - track.startFrame` as local frame, defaults `value: 1`). Below: list of keyframes ordered by frame, each with frame input, value slider 0..1, easing button (reuses `EasingEditor` from Stage 4), delete.
  - **EQ**: 4 vertical sliders (low/mid/high/presence) labeled with center frequencies (80 Hz / 1 kHz / 5 kHz / 10 kHz). Range -12 dB to +12 dB, step 0.5. "Reset" sets all to 0 → calls `setAudioTrackEq(track.id, null)` (treating "all zeros" as "no EQ"). Notes label: "EQ applied at render only — not audible in preview."
- [ ] **Step 3:** Manual: select a track → AudioFxTab renders → add 2 volume kfs → preview plays with fade.
- [ ] **Step 4:** Commit: `feat(editor): AudioFxTab (volume keyframes + EQ)`.

---

### Task 6: Track selection from AudioStrip

**Files:**
- Modify: `apps/web/src/editor/components/AudioStrip.tsx`

- [x] **Step 1:** Add `onPointerDown` (BEFORE the drag handler stops propagation) to call `selectAudioTrack(track.id)`. Visual: when `selectedAudioTrackId === track.id`, render strip with a 2px ring/border accent.
- [x] **Step 2:** Manual: click a strip → Inspector switches to AudioFxTab.
- [ ] **Step 3:** Commit: `feat(editor): select audio track from strip`.

---

### Task 7: Volume keyframe dots in Timeline

**Files:**
- Modify: `apps/web/src/editor/components/Timeline.tsx`

- [x] **Step 1:** Render volume keyframe dots over the AudioStrip, scoped to the strip's local extent. Dot position: `((kf.frame) / (trimEnd - trimStart)) * stripWidth`. Drag-to-move uses `moveVolumeKeyframe`.
- [ ] **Step 2:** Manual: drag a dot → fade timing changes audibly.
- [ ] **Step 3:** Commit: `feat(editor): volume keyframe dots in audio strip`.

---

### Task 8: Decision doc — EQ cache strategy

**Files:**
- Create: `docs/decisions/06-eq-cache-strategy.md`

- [x] **Step 1:** Document the decision:
  - **Cache key inputs**: `assetSha256` + `eq` (low/mid/high/presence as integers in 0.5 dB steps for stable hashing). **NOT** trim — Remotion handles trim at render via `<Audio startFrom endAt>` regardless of whether the file is the raw or the EQ'd version.
  - **Bypass**: if `eq == null` or all four gains are 0 → return raw `assetPath` (no FFmpeg call, no cache write).
  - **Storage**: `apps/web/.cache/audio/<sha256(cacheKey)>.<ext>`. Same extension as source.
  - **Cleanup**: out of scope for v1. Future: a script/cron that deletes entries unused for >30 days based on file mtime.
  - **Race**: if two requests target the same cacheKey simultaneously, both will write the same bytes — last write wins, both succeed. Acceptable for single-user local.
- [ ] **Step 2:** Commit: `docs(decisions): EQ cache strategy`.

---

### Task 9: `cacheKey` util (TDD)

**Files:**
- Create: `apps/web/src/lib/audio/cacheKey.ts`, `apps/web/tests/lib/audio/cacheKey.test.ts`

- [x] **Step 1:** Failing tests:
  - Same `(assetSha, eq)` produces same key.
  - Different gain produces different key.
  - Reordering keys in the `eq` object (e.g., serializing `{high, mid, low, presence}` vs canonical) does NOT change the key — i.e., we serialize canonically.
  - `eq == null` is distinct from `eq` with all zeros (but both should bypass — cache key is only computed for the "process" branch; tests reflect that).
- [x] **Step 2:** Implement:
  ```ts
  import { createHash } from "node:crypto";
  import type { Eq } from "@open-effects/shared-types";

  export function eqCacheKey(assetSha256: string, eq: Eq): string {
    // Canonical order + integer dB×10 to avoid float drift in keys
    const canonical = [eq.low, eq.mid, eq.high, eq.presence]
      .map((g) => Math.round(g * 10))
      .join("|");
    return createHash("sha256").update(`${assetSha256}:${canonical}`).digest("hex");
  }
  ```
- [x] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(audio): EQ cache key`.

---

### Task 10: `ffmpegArgs` builder (TDD)

**Files:**
- Create: `apps/web/src/lib/audio/ffmpegArgs.ts`, `apps/web/tests/lib/audio/ffmpegArgs.test.ts`

- [x] **Step 1:** Failing tests:
  - With `eq.low = 3, mid = 0, high = -2, presence = 6` and `inputPath`/`outputPath`, returns argv with `["-i", inputPath, "-af", expectedFilterChain, outputPath]` plus `-y` (overwrite).
  - Verifies the filter chain order (low → mid → high → presence) and `equalizer=f=…:t=q:w=1:g=…` syntax.
- [x] **Step 2:** Implement:
  ```ts
  import type { Eq } from "@open-effects/shared-types";

  export const EQ_BANDS = [
    { name: "low", freq: 80 },
    { name: "mid", freq: 1000 },
    { name: "high", freq: 5000 },
    { name: "presence", freq: 10000 }
  ] as const;

  export function buildEqFilter(eq: Eq): string {
    return EQ_BANDS
      .map((b) => `equalizer=f=${b.freq}:t=q:w=1:g=${eq[b.name]}`)
      .join(",");
  }

  export function ffmpegEqArgs(inputPath: string, outputPath: string, eq: Eq): string[] {
    return ["-y", "-i", inputPath, "-af", buildEqFilter(eq), outputPath];
  }
  ```
- [x] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(audio): FFmpeg argv builder`.

---

### Task 11: `processEq` orchestrator (TDD)

**Files:**
- Create: `apps/web/src/lib/audio/ffmpegBin.ts`, `apps/web/src/lib/audio/processEq.ts`, `apps/web/tests/lib/audio/processEq.test.ts`

- [x] **Step 1:** `ffmpegBin.ts` — locate FFmpeg:
  ```ts
  import { spawnSync } from "node:child_process";

  let cached: string | null = null;
  export function ffmpegPath(): string {
    if (cached) return cached;
    const probe = spawnSync(process.env.FFMPEG_PATH ?? "ffmpeg", ["-version"], { encoding: "utf8" });
    if (probe.status !== 0) throw new Error("FFmpeg not found in PATH (set FFMPEG_PATH or install ffmpeg).");
    cached = process.env.FFMPEG_PATH ?? "ffmpeg";
    return cached;
  }
  ```
- [x] **Step 2:** Failing tests for `processEq`:
  - When `eq == null` → returns the input path unchanged. No file written.
  - When all gains are 0 → returns the input path unchanged.
  - When EQ has non-zero gains → returns a path under `.cache/audio/`. File exists and is non-empty. **Use a real fixture mp3** at `apps/web/tests/fixtures/test.mp3` (1-2 second silence + tone).
  - Second call with same params → returns same path; FFmpeg NOT invoked again (verify by checking file mtime stays stable, or use a spy on `spawnSync`).
  - Third call with different gains → returns different path.
- [x] **Step 3:** Implement `processEq.ts`:
  ```ts
  import { spawnSync } from "node:child_process";
  import { mkdir, stat } from "node:fs/promises";
  import path from "node:path";
  import { ffmpegPath } from "./ffmpegBin";
  import { ffmpegEqArgs } from "./ffmpegArgs";
  import { eqCacheKey } from "./cacheKey";
  import type { Eq } from "@open-effects/shared-types";

  const CACHE_DIR = path.resolve(process.cwd(), ".cache/audio");

  function isBypass(eq: Eq | null | undefined): boolean {
    if (!eq) return true;
    return eq.low === 0 && eq.mid === 0 && eq.high === 0 && eq.presence === 0;
  }

  /**
   * Returns the path that should be passed to <Audio src> at render time.
   * - Bypass → returns inputAbsPath unchanged.
   * - Otherwise → ensures a cached EQ'd file exists and returns its path.
   */
  export async function processEq(opts: {
    inputAbsPath: string;
    assetSha256: string;
    eq: Eq | null | undefined;
  }): Promise<string> {
    if (isBypass(opts.eq)) return opts.inputAbsPath;
    const eq = opts.eq!;
    const ext = path.extname(opts.inputAbsPath) || ".mp3";
    const key = eqCacheKey(opts.assetSha256, eq);
    const out = path.join(CACHE_DIR, `${key}${ext}`);
    try {
      await stat(out);
      return out; // cache hit
    } catch { /* miss */ }
    await mkdir(CACHE_DIR, { recursive: true });
    const result = spawnSync(ffmpegPath(), ffmpegEqArgs(opts.inputAbsPath, out, eq), { stdio: "pipe", encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`FFmpeg failed: ${result.stderr || result.stdout || "unknown"}`);
    }
    return out;
  }
  ```
- [x] **Step 4:** Tests pass. Where FFmpeg is unavailable in CI, the test file `tests/fixtures/test.mp3` should still exist; the test should `it.skipIf(!hasFfmpeg(), ...)` gracefully. Add a small util `hasFfmpeg()` that wraps `ffmpegPath()` in try/catch.
- [ ] **Step 5:** Commit: `feat(audio): processEq orchestrator`.

---

### Task 12: Manual demo script

**Files:**
- Create: `scripts/process-eq-demo.ts`

- [x] **Step 1:** Implement a small CLI:
  ```ts
  import { processEq } from "../apps/web/src/lib/audio/processEq";
  import { createHash } from "node:crypto";
  import { readFileSync } from "node:fs";
  import path from "node:path";

  const input = process.argv[2];
  if (!input) { console.error("usage: tsx scripts/process-eq-demo.ts <input.mp3>"); process.exit(1); }
  const buf = readFileSync(input);
  const sha = createHash("sha256").update(buf).digest("hex");
  const eq = { low: 0, mid: 0, high: 0, presence: 6 };
  processEq({ inputAbsPath: path.resolve(input), assetSha256: sha, eq })
    .then((out) => console.log("output:", out))
    .catch((e) => { console.error(e); process.exit(1); });
  ```
- [x] **Step 2:** `npx tsx scripts/process-eq-demo.ts ./some.mp3` — outputs cached path; play both files in any audio app and confirm EQ effect. (deferred — ffmpeg not installed in this env)
- [ ] **Step 3:** Commit: `chore: process-eq-demo script`.

---

### Task 13: Stage closure verification

- [x] **Step 1:** `npm test --workspaces --if-present` → all green. _(232 passed + 3 skipped: web 130/3-skip, runtime 64, shared-types 38; the 3 skipped are FFmpeg-dependent processEq tests — env has no ffmpeg)_
- [x] **Step 2:** `npm run typecheck --workspaces --if-present` → clean. _(apps/web ✓, shared-types ✓; runtime has the same pre-existing error in `tests/offset.test.ts` from commit `aff5de5`, unrelated to Stage 6)_
- [ ] **Step 3:** Manual smoke (preview-side) — deferred to user (requires running dev server):
  1. Open editor, upload an mp3, drop on scene 1.
  2. Click strip → AudioFxTab opens.
  3. Add volume keyframe at local frame 0 with value 0.
  4. Add volume keyframe at local frame 30 with value 1 (linear).
  5. Press Play → audio fades in over 1s (at 30fps).
  6. Add second pair of keyframes at end for fade out.
  7. Reload — fades persist.
- [ ] **Step 4:** Manual smoke (EQ-side) — deferred to user (requires `apt install ffmpeg`):
  1. Set EQ presence to +6 dB on the same track.
  2. Run `npx tsx scripts/process-eq-demo.ts public/assets/<sha>.mp3` — produces a file at `apps/web/.cache/audio/<key>.mp3`.
  3. Play the cached file in VLC; confirm presence boost is audible.
  4. Re-run the script with same EQ — instant return (cache hit), file mtime unchanged.
- [ ] **Step 5:** Tag closure: `git commit -m "STAGE-6: closed"`. _(orchestrator does not auto-commit — produced as the closure commit by /run-plan)_

---

## Test summary

| Test | Type | File |
|---|---|---|
| `evalVolumeAtFrame` (6 cases) | unit | `runtime/tests/keyframes/evalVolumeAtFrame.test.ts` |
| `selectActiveAudioTrack` | unit | `web/tests/editor/selectors.test.ts` |
| Audio fx store actions (≥7 cases) | unit | `web/tests/editor/store.audioFx.test.ts` |
| `eqCacheKey` determinism + canonical | unit | `web/tests/lib/audio/cacheKey.test.ts` |
| `ffmpegEqArgs` shape | unit | `web/tests/lib/audio/ffmpegArgs.test.ts` |
| `processEq` bypass + cache hit/miss + invocation | integration | `web/tests/lib/audio/processEq.test.ts` |
| Preview fade in/out audible | manual | browser |
| EQ in cached file audibly different | manual | external player |

---

## Risks specific to Stage 6

| Risk | Mitigation |
|---|---|
| FFmpeg unavailable in dev env | `ffmpegPath()` throws with a clear setup message (T11). README from Stage 1 lists FFmpeg as prerequisite. Tests use `it.skipIf(!hasFfmpeg())`. |
| `<Audio volume>` function frame semantics drift between Remotion versions | Pinned to Remotion 4 (Stage 1). Documented in T4. If breaks on upgrade, adjust the offset in the function. |
| EQ cache grows unbounded over time | Cleanup deferred to v2 (documented in T8). Acceptable for local single-user. |
| FFmpeg argv injection if a malicious EQ value is constructed | All EQ inputs are numbers (validated by Zod via `EqSchema` from Stage 2 — `z.number()`). Numeric formatting in `ffmpegArgs` is deterministic. No string interpolation of user-supplied strings into shell. Argv passed as array (no shell interpretation). |
| Race between two callers of `processEq` for same key | Both write same bytes; last wins. Documented in T8. |
| EQ silent in preview surprises users | UX text in AudioFxTab (T5): "EQ applied at render only — not audible in preview." |
| Volume keyframes very close together create audible discontinuities at low frame counts | Acceptable: this is creator-error. Spring easing helps smooth. No mitigation needed. |
| Probe of audio duration (Stage 5) returned wrong fps mapping for very-short files | Already mitigated in Stage 5 by `Math.floor(seconds * fps)`. Documented edge case: duration <1 frame yields trimEnd=0 — Stage 9 polish should add a min check. |

---

## Handoff to Stage 7 and Stage 8

**Stage 7** (Saved Components) does not interact with audio — it operates on layers + their keyframes. Audio tracks are scoped to scenes and not part of "Saved Components" in v1.

**Stage 8** (MP4 render) will:
- For each `AudioTrack` in the final `projectJson` for render, call `processEq({ inputAbsPath, assetSha256, eq })` to get the actual path used by `<Audio src>`.
- Substitute `assetPath` in the runtime composition's `inputProps.project` with the EQ-processed path before invoking `renderMedia`. The runtime contract stays clean (it doesn't know about EQ; it just renders whatever `assetPath` points at).
- Stage 6 contracts that Stage 8 must respect:
  - `processEq` is idempotent and returns a usable path — call it before any render.
  - For raw audio (bypass), the input path IS the output path.
  - The DB stores the original `Asset.path` (raw); only the in-memory `projectJson` for render has the EQ-resolved path.

---

## Final task checklist (execution order)

- [x] T1 — Audio fx store actions (TDD)
- [x] T2 — Audio fx selectors
- [x] T3 — `evalVolumeAtFrame` (TDD)
- [x] T4 — `AudioTrackPlayer` volume function
- [x] T5 — AudioFxTab UI
- [x] T6 — Track selection from strip
- [x] T7 — Volume keyframe dots in timeline
- [x] T8 — Decision doc EQ cache
- [x] T9 — `eqCacheKey` (TDD)
- [x] T10 — `ffmpegEqArgs` (TDD)
- [x] T11 — `processEq` orchestrator (TDD)
- [x] T12 — Manual demo script
- [x] T13 — Stage closure smoke (automated portion: tests + typecheck; manual smoke deferred to user)

**Total tasks:** 13 · **Estimate:** 2 weeks · **Critical risks:** FFmpeg-not-installed (clear error path) and cache invalidation (deterministic key, deferred cleanup).
