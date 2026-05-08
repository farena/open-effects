# Plan 11 — Audio Overhaul (cut + split, multi-track group, layer-parity UI)

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read `00-master-plan.md`, `05-audio-basic.md`, `06-audio-keyframes-eq.md`, `09-polish.md` first. This plan is post-v1 (consumed from `10-following-steps.md`, items 1–3). It introduces a **track-cut + split** action, generalizes the timeline to render **multiple stacked audio lanes per scene** under a collapsible AUDIO group, and **aligns the AudioStrip's chrome with LayerBar's** (remove icon position, keyframe dot design, animatable-property picker pattern). The data model stays compatible: `Scene.audioTracks` is already an array; this plan only adds one action (`splitAudioTrack`) and reorganizes UI.

**Goal:** A user can (a) split an audio track at the playhead into two tracks that share the same `Asset` and play seamlessly, (b) stack multiple audio tracks in the same scene shown as separate lanes within a collapsible AUDIO group, and (c) interact with audio tracks using the same affordances as layers (matching trash-icon position, keyframe dots styled identically, an "+ Add keyframe" picker over the animatable-property list — `volume` for now, with the picker generalized so future props plug in trivially).

**Architecture:** Splitting is purely a store action — `splitAudioTrack(trackId, splitFrameLocal)` creates a sibling track with the same `assetId`/`assetPath`, sets `trimStart` of the new track to the original's `trimStart + splitFrameLocal`, and clamps the original's `trimEnd` down to that boundary. Volume keyframes are partitioned by their `frame < splitFrameLocal`. The Timeline currently renders one fixed audio lane row per scene; we replace that with an **AudioGroup row** (header, expand/collapse caret, "+ Add lane" stub) followed by N stacked lane rows — one per track in the scene — using the same row helpers as layers. AudioStrip's trash icon is moved to the strip body (mirroring LayerBar's pattern in the LayersPanel), and the volume keyframe dot is restyled to match `bg-primary` exactly. A new `AudioPropertyPicker` reuses `PropertyPicker.tsx`'s pattern for layer animatable props but lists only `volume` for v1, with explicit hooks for `pan` / `pitch` later. The "Audio FX" inspector tab keeps its EQ section but the volume-keyframe section is reorganized to mirror `KeyframesTab.tsx` (one section per animatable property, each with "+ Add keyframe @ current frame" button + ordered rows).

**Tech Stack additions:** none — reuses existing primitives.

---

## Acceptance criteria

1. **Split action.** Right-click (or a `Split` button shown on a selected strip) on an AudioStrip splits at the current playhead's local frame into two tracks `A'` (`trimStart..split`) and `B` (`split..trimEnd`). Both tracks reference the same `Asset` (same `assetId`, `assetPath`, `assetSha256`). Volume keyframes split by frame; EQ is duplicated to both halves. Playback through both halves is gapless and equivalent to the original (verified in `<Player>` and at render).
2. **Multi-track lanes.** Adding more than one audio asset to the same scene produces **stacked separate lanes** inside an **AUDIO group** in the Timeline. The group has a caret header with name "Audio" + count badge, behaves like the scene-expand/collapse caret, and respects the same `expandedByScene` pattern.
3. **Drop on group.** Dragging a new asset onto either the group header OR any of its lanes appends a new track to the scene (current behavior continues to work — single drop zone).
4. **Trash position parity.** AudioStrip's delete affordance moves to mirror layers: the strip itself has no trailing trash button; the per-track row in the **left rail** (same column where layers show their visibility/trash buttons) shows a trash icon at the same offset.
5. **Keyframe dot parity.** Volume keyframe dots use the same primary color (`bg-primary`) and 10px size as layer keyframe dots in `PropertyLane`. Hover, drag, and drag-collision behavior match.
6. **Property picker.** AudioFxTab gains an "+ Add keyframe" picker that lists currently animatable audio props (initial: `volume`); selecting "volume" inserts a keyframe at `currentFrame - track.startFrame` with `value=1`. The picker's API is generic enough that adding `pan`/`pitch` later only requires adding entries to a registry constant.
7. **Persistence.** Split tracks survive page reload (autosave PATCHes the new array). Backwards-compat: existing single-track projects keep rendering identically.

---

## File structure

```
apps/web/
├── src/
│   ├── editor/
│   │   ├── store.ts                                # MODIFY: add splitAudioTrack action
│   │   ├── store.types.ts                          # MODIFY
│   │   ├── selectors.ts                            # MODIFY: selectAudioPropertyPicker
│   │   └── components/
│   │       ├── Timeline.tsx                        # MODIFY: AudioGroup + per-track lanes; left-rail trash buttons
│   │       ├── AudioStrip.tsx                      # MODIFY: drop trash button; ensure split trigger surface; restyle dots via shared constant
│   │       ├── audio/
│   │       │   ├── AudioGroupHeader.tsx            # NEW: caret + label + drop target + count
│   │       │   ├── AudioLaneRow.tsx                # NEW: one lane row (left rail label + drop zone + AudioStrip)
│   │       │   └── AudioPropertyPicker.tsx        # NEW: mirrors PropertyPicker for audio props
│   │       └── inspector/
│   │           └── AudioFxTab.tsx                  # MODIFY: split volume section into per-property groups; "+Add keyframe" via picker
└── tests/
    └── editor/
        ├── store.audio.split.test.ts               # NEW
        └── audio-group.test.tsx                    # NEW (jsdom render)
```

No runtime/shared-types changes — the schema already supports unlimited tracks per scene.

---

## Acceptance criteria → tasks map

| AC | Tasks |
|---|---|
| 1. Split action | T1, T2, T3 |
| 2. Multi-track lanes / AUDIO group | T4, T5, T6 |
| 3. Drop on group | T6 |
| 4. Trash position parity | T7 |
| 5. Keyframe dot parity | T8 |
| 6. Property picker | T9, T10 |
| 7. Persistence + back-compat | T11 |

---

## Task list (execution order)

### Task 1: `splitAudioTrack` store action (TDD)

**Files:**
- Modify: `apps/web/src/editor/store.ts`, `store.types.ts`
- Create: `apps/web/tests/editor/store.audio.split.test.ts`

- [ ] **Step 1:** Add to `EditorActions`:
  ```ts
  splitAudioTrack: (trackId: string, splitFrameLocal: number) => void;
  ```
  `splitFrameLocal` is in **track-local frames** (frame 0 = `track.startFrame`), matching `volumeKeyframes[].frame` semantics.
- [ ] **Step 2:** Failing tests:
  - Splitting a track `[startFrame=10, trimStart=0, trimEnd=60]` at local frame 30 → original becomes `trimEnd=30`; new track has `startFrame=10+30=40`, `trimStart=0+30=30`, `trimEnd=60`. Both reference same `assetId`/`assetPath`.
  - Volume keyframes at local frames `[5, 25, 40, 55]` partition: original keeps `[5, 25]` unchanged; new track keeps `[40, 55]` rebased to `[10, 25]`.
  - EQ is copied (deep) to both halves.
  - Splitting at local frame ≤ 0 or ≥ `(trimEnd - trimStart)` is a no-op + console.warn.
  - Splitting preserves order: new track appended after original in `scene.audioTracks` array.
- [ ] **Step 3:** Implement (use existing `mutateAudioTrack` to find the scene, then operate on the array directly):
  ```ts
  splitAudioTrack: (trackId, splitFrameLocal) =>
    set((s) => {
      for (const sc of s.project.scenes) {
        const i = sc.audioTracks.findIndex((t) => t.id === trackId);
        if (i < 0) continue;
        const t = sc.audioTracks[i]!;
        const span = t.trimEnd - t.trimStart;
        if (splitFrameLocal <= 0 || splitFrameLocal >= span) {
          console.warn("splitAudioTrack: split outside track range");
          return;
        }
        const splitTrim = t.trimStart + splitFrameLocal;
        const newTrack = {
          ...t,
          id: newId(),
          startFrame: t.startFrame + splitFrameLocal,
          trimStart: splitTrim,
          trimEnd: t.trimEnd,
          eq: t.eq ? { ...t.eq } : null,
          volumeKeyframes: t.volumeKeyframes
            .filter((k) => k.frame >= splitFrameLocal)
            .map((k) => ({ ...k, frame: k.frame - splitFrameLocal })),
        };
        t.trimEnd = splitTrim;
        t.volumeKeyframes = t.volumeKeyframes.filter(
          (k) => k.frame < splitFrameLocal,
        );
        sc.audioTracks.splice(i + 1, 0, newTrack);
        return;
      }
    });
  ```
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit: `feat(editor): splitAudioTrack store action`.

---

### Task 2: Split UI trigger on AudioStrip

**Files:**
- Modify: `apps/web/src/editor/components/AudioStrip.tsx`

- [ ] **Step 1:** Add a `Split` button (lucide `Scissors`) to the strip's body that appears only when the strip is `isSelected`. Tooltip: `"Split at playhead (S)"`.
- [ ] **Step 2:** On click: read `currentFrame` from store; compute `splitFrameLocal = currentFrame - (sceneOffsetFrames + track.startFrame)`. If outside `(0, trimEnd-trimStart)`, show toast `"Move playhead inside the strip to split."` and skip.
- [ ] **Step 3:** Bind keyboard `S` (lower-case, no modifiers) when an audio track is selected (use the same `useEffect`-window-keydown pattern as `useUndoRedo`). Skip if focus is inside an input/textarea/contenteditable.
- [ ] **Step 4:** Manual: select strip → press S → strip splits in place at playhead. Check that the new pair plays gaplessly in `<Player>`.
- [ ] **Step 5:** Commit: `feat(editor): split audio strip at playhead`.

---

### Task 3: Render parity test for split tracks

**Files:**
- Modify: `apps/web/tests/editor/store.audio.split.test.ts`

- [ ] **Step 1:** Add an integration-style test (still pure store): build a scene with one track containing 4 volume keyframes, split at the midpoint, assert that — when you reconstruct the "effective volume curve" by querying both halves at consecutive global frames — values are continuous (no discontinuity) at the seam.
- [ ] **Step 2:** Document the implication in a brief inline comment in `splitAudioTrack`: the playback contract is that playing both halves end-to-end is sample-equivalent to playing the original (Remotion `<Audio>` honors `startFrom`/`endAt` exactly; FFmpeg at render does the same).
- [ ] **Step 3:** Commit: `test(editor): split audio continuity at seam`.

---

### Task 4: AudioGroupHeader component

**Files:**
- Create: `apps/web/src/editor/components/audio/AudioGroupHeader.tsx`

- [ ] **Step 1:** Implement a row component matching the visual rhythm of the existing scene header in Timeline left-rail (same height = `ROW_H = 28`, same caret button using `ChevronDown`/`ChevronRight`):
  - Props: `expanded: boolean`, `onToggle: () => void`, `count: number`, `onAssetDrop: (asset: { id: string; path: string }) => void`.
  - Render: caret · `Music` icon · label `"Audio"` · count badge (e.g. `(3)`).
  - Drop target: `onDragOver={e => e.preventDefault()}`, `onDrop` calls `onAssetDrop` with parsed `application/x-asset` payload.
- [ ] **Step 2:** Commit: `feat(editor): AudioGroupHeader`.

---

### Task 5: AudioLaneRow component

**Files:**
- Create: `apps/web/src/editor/components/audio/AudioLaneRow.tsx`

- [ ] **Step 1:** Implement a per-track lane that owns BOTH the left-rail row (visibility-style placeholder + name + trash button) AND the right-side track surface (drop zone + `AudioStrip`).
  - The component takes `track`, `sceneId`, `sceneOffsetFrames`, `total`, `timelineWidthPx`, `pxPerFrame`, plus a `side: "left" | "right"` flag so Timeline can render the two halves into the synced left/right scrollers (the existing pattern `leftRef` / `rightRef`).
  - Left side: `Music` icon dim · track name (or filename) · trash button calling `removeAudioTrack(track.id)`.
  - Right side: render `<AudioStrip>` inside a `relative h-[ROW_H]` div, dropping the strip's own trash button (Task 7).
- [ ] **Step 2:** Commit: `feat(editor): AudioLaneRow`.

---

### Task 6: Replace single audio-lane row with AudioGroup + lanes in Timeline

**Files:**
- Modify: `apps/web/src/editor/components/Timeline.tsx`

- [ ] **Step 1:** In the left rail's `sorted.map((scene) => …)` block, replace the existing fixed `Audio` label row (currently a single static row with `Music` icon) with:
  - 1 AudioGroupHeader row (uses an `expandedAudioByScene` map analogous to `expandedByScene`; defaults to `true`).
  - When expanded, N AudioLaneRow rows (one per `scene.audioTracks` entry), in the order of the array — newly-split tracks appear immediately below their parent (Task 1 already inserts in the right place).
- [ ] **Step 2:** In the right rail, replace the existing single `Audio lane drop zone` div (which currently renders all strips at the same `top`) with:
  - 1 right-side header drop zone matching AudioGroupHeader (same height, accepts asset drop appending to scene).
  - When expanded, N right-side lane rows; each renders one `<AudioStrip>` for its track. **Critical:** strips no longer overlap vertically — each lives in its own row.
- [ ] **Step 3:** Update `trackRowCount` math: each scene contributes `1 (sceneBar) + (expanded? N_layers : 0) + 1 (audioGroupHeader) + (audioExpanded? N_audio : 0)` rows.
- [ ] **Step 4:** Persist `expandedAudioByScene` to `localStorage` key `oe-timeline-audio-expanded` (object map; clamp on read like the others).
- [ ] **Step 5:** Manual: drop two audio assets on scene 1 → 2 lanes appear stacked under the AUDIO group → toggle the group → lanes hide; toggle on → reappear.
- [ ] **Step 6:** Commit: `feat(timeline): AUDIO group with stacked per-track lanes`.

---

### Task 7: Trash button parity (left rail vs strip body)

**Files:**
- Modify: `apps/web/src/editor/components/AudioStrip.tsx`
- Modify: `apps/web/src/editor/components/audio/AudioLaneRow.tsx`

- [ ] **Step 1:** In `AudioStrip.tsx`, remove the trailing `<button aria-label="Delete audio track">` (the in-strip trash). Keep the strip's edges and body cleaner — only the trim handles + body (with split button when selected) remain.
- [ ] **Step 2:** In `AudioLaneRow.tsx` (left rail), add the trash button in the same column position the layer rows use (mirror `LayersPanel.tsx:114,183` pattern — `Trash2` icon, hover bg `#5c2b2b`, calls `onDelete`).
- [ ] **Step 3:** Manual: visually compare layer rows and audio lane rows in the left rail — trash icons must align.
- [ ] **Step 4:** Commit: `refactor(editor): unify audio/layer trash position`.

---

### Task 8: Keyframe dot parity

**Files:**
- Modify: `apps/web/src/editor/components/AudioStrip.tsx`

- [ ] **Step 1:** In `VolumeKeyframeDot`, change `bg-yellow-400 size-2` to `bg-primary size-2.5` so it matches `PropertyLane`'s dot in `Timeline.tsx:236`.
- [ ] **Step 2:** Verify drag interactions still work and don't conflict with the strip body drag (existing `e.stopPropagation()` is the contract — keep it).
- [ ] **Step 3:** Update visual snapshot or jsdom test if any. (Probably none — accept manual.)
- [ ] **Step 4:** Commit: `style(editor): unify keyframe dot styling`.

---

### Task 9: Audio property registry + AudioPropertyPicker

**Files:**
- Create: `apps/web/src/editor/components/audio/AudioPropertyPicker.tsx`
- Modify: `apps/web/src/editor/selectors.ts`

- [ ] **Step 1:** Define a registry constant inside `AudioPropertyPicker.tsx`:
  ```ts
  export const AUDIO_PROPERTIES = [
    { key: "volume", label: "Volume", min: 0, max: 1, default: 1 },
    // future: { key: "pan", ... }, { key: "pitch", ... }
  ] as const;
  export type AudioPropertyKey = typeof AUDIO_PROPERTIES[number]["key"];
  ```
- [ ] **Step 2:** Implement the picker as a `<Popover>` mirroring `PropertyPicker.tsx`'s shape: trigger button labeled `"+ Add keyframe"`, content lists each prop in `AUDIO_PROPERTIES`. Selecting one calls `onAdd(key)`.
- [ ] **Step 3:** Selector helper: `selectAudioAnimatedProperties(state)` → returns the **set of property keys that already have keyframes on the active track**. For v1 this is just `["volume"]` if `track.volumeKeyframes.length > 0` else `[]`. Designed so future props (pan/pitch) plug in.
- [ ] **Step 4:** Commit: `feat(editor): AudioPropertyPicker + animated-prop selector`.

---

### Task 10: AudioFxTab refactor — per-property groups + picker

**Files:**
- Modify: `apps/web/src/editor/components/inspector/AudioFxTab.tsx`

- [ ] **Step 1:** Refactor the volume section to mirror `KeyframesTab.tsx`'s layout:
  - Header row with "Volume" label + per-property `+ Add keyframe @ frame N` button.
  - Below: ordered rows from `sortedKeyframes` (existing `VolumeKeyframeRow`).
  - When other props arrive, repeat the pattern. Wrap the per-property block in a small helper `<AudioPropertyGroup propKey title rows>`.
- [ ] **Step 2:** Above the property groups, render `AudioPropertyPicker` from Task 9. On select `volume`, call `addVolumeKeyframe(track.id, localFrame, 1, LINEAR_EASING)`.
- [ ] **Step 3:** Keep the EQ section unchanged below a divider.
- [ ] **Step 4:** Manual: select a track → click "+ Add keyframe" → choose Volume → keyframe appears at current local frame.
- [ ] **Step 5:** Commit: `feat(inspector): AudioFxTab per-property groups + picker`.

---

### Task 11: Persistence + back-compat smoke

**Files:**
- Create: `apps/web/tests/editor/audio-group.test.tsx`

- [ ] **Step 1:** jsdom render: build a project fixture with 1 scene + 3 audio tracks; render `<Timeline />`; assert (a) one AudioGroupHeader present, (b) 3 AudioLaneRow present, (c) trash buttons in left-rail are aligned (same `data-testid` column class).
- [ ] **Step 2:** Manual smoke:
  1. Open an existing project from before this plan (no data migration). Verify it loads, audio tracks render in lanes, autosave PATCHes succeed.
  2. Split a track, reload, confirm the two halves persist with correct trim ranges.
  3. Add 3 tracks to one scene; collapse the AUDIO group; reload; group state persists from `localStorage`.
- [ ] **Step 3:** `npm test --workspaces --if-present` clean.
- [ ] **Step 4:** `npm run typecheck --workspaces --if-present` clean.
- [ ] **Step 5:** Commit closure: `chore(audio): plan 11 closure`.

---

## Test summary

| Test | Type | File |
|---|---|---|
| `splitAudioTrack` correctness + edge cases (5+ cases) | unit | `tests/editor/store.audio.split.test.ts` |
| Continuity at seam after split | unit | same |
| AudioGroupHeader + lanes render counts | jsdom | `tests/editor/audio-group.test.tsx` |
| Drag-to-split via keyboard `S` | manual | browser |
| Multi-track stacking visual | manual | browser |
| Trash icon alignment with layer rows | manual | browser |

---

## Risks

| Risk | Mitigation |
|---|---|
| `expandedAudioByScene` localStorage key collision with future panels | Namespaced key `oe-timeline-audio-expanded`; treat unknown keys as default-true on read. |
| Removing the in-strip trash regresses muscle memory | The lane-row trash is in the same column as layer rows — users get *consistent* delete affordances across scenes/layers/audio. Document in the v1.1 changelog. |
| Split with volume keyframes exactly at the split frame is ambiguous | Tie-breaker: keyframes at `frame === splitFrameLocal` go to the **right** half (`>= splitFrameLocal`). Documented in T1 step 3 implementation comment. |
| AudioStrip dot color change collides with future "scene keyframe" violet | Scene keyframe dots already use `bg-violet-400` — distinct from `bg-primary`. No collision. |
| Split spawns asset deduplication concerns at render | Render reads the raw asset by `assetPath`; both split halves point to the same disk file. Remotion `<Audio>` handles `startFrom`/`endAt` independently. No EQ cache change needed. |
| Performance with many lanes per scene | Each lane is a tiny DOM subtree (strip + waveform). Existing `wavesurfer.js` lazy load remains. Stress: 10 audio tracks/scene should still feel snappy. Bench in the v2 perf doc if needed. |
| Animated-property registry growth (pan/pitch) | The registry is purely additive; `evalVolumeAtFrame` already uses the same easing model — clone the function for new scalars when needed. |
| Test coverage for jsdom render of multiple wavesurfer instances | `wavesurfer.js` is mocked in the existing test setup (or use lazy guard); confirm by running the new test against current vitest config before commit. |

---

## Final task checklist

- [ ] T1 — `splitAudioTrack` action (TDD)
- [ ] T2 — Split trigger on AudioStrip + `S` shortcut
- [ ] T3 — Continuity test
- [ ] T4 — AudioGroupHeader
- [ ] T5 — AudioLaneRow
- [ ] T6 — Timeline AUDIO group + stacked lanes
- [ ] T7 — Trash button parity
- [ ] T8 — Keyframe dot parity
- [ ] T9 — AudioPropertyPicker + registry
- [ ] T10 — AudioFxTab refactor
- [ ] T11 — Persistence + back-compat smoke

**Total tasks:** 11 · **Estimate:** ~2 weeks (1 dev). · **Critical risks:** split semantics at boundaries (T1 contract), Timeline DOM restructure regressions (T6 — covered by T11 jsdom test + manual).
