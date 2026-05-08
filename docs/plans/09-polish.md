# Stage 9 — Polish (undo/redo + scene transitions + edge cases) Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read all prior plans first. Stage 9 is the bridge from "everything works" to "shippable v1". It adds undo/redo with selective tracking, scene transitions that render identically in preview and MP4, comprehensive validation/loading/error/empty states, and validates the documented performance targets (30 layers × 50 keyframes per scene at ≥30fps in `<Player>`).

**Goal:** Reach a state where the editor is robust enough for the marketing team to use without dev intervention. All operations are reversible (Cmd/Ctrl+Z), scene transitions can be configured visually and survive the round-trip to MP4, every form rejects invalid input, every async action has a loading and an error state, every empty list explains itself, and the documented stress scenario plays smoothly.

**Architecture:** Undo/redo via the `zundo` middleware on the existing Zustand store, with `partialize` excluding ephemeral state (selection, currentFrame, isPlaying, saveStatus) so undo only affects the persisted project. Scene transitions implemented with `@remotion/transitions` (TransitionSeries + presets) — the runtime composition switches from `<Sequence>`-based scene placement to `<TransitionSeries>` when any scene has `transitionIn != null`. Total duration formula updated to account for transition overlaps. Validation centralized in Zod schemas (already in `shared-types`); UI forms call `safeParse` and surface errors inline. Loading/empty/error states use shadcn `Skeleton` and consistent toast patterns. Performance: profile `computeStylesAtFrame` with 30 layers × 50 keyframes; if frame budget exceeded, add per-property keyframe-segment caching (precompute when keyframes change).

**Tech Stack additions:** `zundo` (~1KB Zustand temporal middleware) · `@remotion/transitions` (presets + TransitionSeries).

---

## Acceptance criteria → tasks map (Stage 9 master ACs)

| Master AC | Tasks |
|---|---|
| 1. Undo/redo via Immer patches (zundo) for tracked operations | T1, T2, T3 |
| 2. Keyboard shortcuts Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z | T2 |
| 3. Scene transitions (none, fade, slide-*) | T4, T5 |
| 4. Transitions identical in preview and render | T5, T6 |
| 5. Validation: name required, dimensions, fps | T7 |
| 6. Loading/error states on API calls | T8, T9 |
| 7. Empty states with CTAs | T10 |
| 8. Performance ≥30fps with 30×50 stress | T11, T12 |

---

## File structure to create / modify

```
apps/web/
├── package.json                              # MODIFY: add zundo
├── src/
│   ├── editor/
│   │   ├── store.ts                          # MODIFY: zundo wrapper
│   │   ├── store.types.ts                    # MODIFY: temporal types
│   │   ├── useUndoRedo.ts                    # NEW: hook + keyboard shortcuts
│   │   └── components/
│   │       ├── Topbar.tsx                    # MODIFY: undo/redo buttons + tooltips
│   │       ├── inspector/
│   │       │   ├── Inspector.tsx             # MODIFY: route to TransitionTab when scene selected
│   │       │   └── TransitionTab.tsx         # NEW
│   │       ├── EmptyState.tsx                # NEW: shared empty-state primitive
│   │       └── (loading skeletons inline)    # MODIFY individual files
│   ├── lib/
│   │   └── flushAutosave.ts                  # NEW: optional immediate flush
│   ├── app/
│   │   ├── projects/page.tsx                 # MODIFY: empty + loading
│   │   └── projects/[id]/page.tsx            # MODIFY: error boundary
└── tests/
    ├── editor/
    │   ├── store.undo.test.ts                # NEW
    │   └── transitions.test.ts               # NEW (offset math)
    └── perf/
        └── computeStyles.bench.ts            # NEW perf script

packages/runtime/
├── package.json                              # MODIFY: add @remotion/transitions
├── src/
│   ├── OpenEffectsComposition.tsx            # MODIFY: TransitionSeries variant
│   ├── components/
│   │   └── transitions.tsx                   # NEW: maps Transition schema → presets
│   └── lib/
│       └── offset.ts                         # MODIFY: account for transition overlap
└── tests/
    ├── lib/
    │   └── offset.transitions.test.ts        # NEW
    └── components/
        └── transitions.test.tsx              # NEW
```

---

## Task list (execution order)

### Task 1: Add `zundo` middleware to the editor store

**Files:**
- Modify: `apps/web/src/editor/store.ts`, `store.types.ts`

- [x] **Step 1:** `npm install zundo -w apps/web`
- [x] **Step 2:** Wrap the existing `immer` store with `temporal`:
  ```ts
  import { temporal } from "zundo";
  import deepEqual from "fast-deep-equal"; // optional, for equality

  export const useEditorStore = create<EditorState & EditorActions>()(
    temporal(
      immer((set, get) => ({ /* existing impl */ })),
      {
        partialize: (state) => ({ project: state.project }) as any,
        limit: 100,
        equality: (a, b) => a.project === b.project // immer ensures ref equality on no-change
      }
    )
  );

  export const useTemporal = () => useEditorStore.temporal.getState();
  ```
- [x] **Step 3:** Verify nothing breaks: typecheck and existing tests pass.
- [x] **Step 4:** Commit: `feat(editor): zundo temporal middleware`.

---

### Task 2: `useUndoRedo` hook + keyboard shortcuts + Topbar buttons (TDD)

**Files:**
- Create: `apps/web/src/editor/useUndoRedo.ts`, `apps/web/tests/editor/store.undo.test.ts`
- Modify: `apps/web/src/editor/components/Topbar.tsx`

- [ ] **Step 1:** Failing tests:
  - After `addLayer`, `useTemporal().pastStates.length === 1`.
  - Calling `undo()` reverses `addLayer`.
  - Calling `redo()` re-applies it.
  - `selectLayer`, `setCurrentFrame`, `play`, `pause`, `setSaveStatus`, `markSaved` do NOT add to pastStates (excluded via `partialize`).
- [ ] **Step 2:** Implement `useUndoRedo.ts`:
  ```ts
  "use client";
  import { useEffect } from "react";
  import { useEditorStore } from "./store";

  export function useUndoRedo() {
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const mod = e.metaKey || e.ctrlKey;
        if (!mod) return;
        if (e.key.toLowerCase() === "z" && !e.shiftKey) {
          e.preventDefault();
          useEditorStore.temporal.getState().undo();
        } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
          e.preventDefault();
          useEditorStore.temporal.getState().redo();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);
  }
  ```
- [ ] **Step 3:** Add Topbar buttons "Undo" / "Redo" with shadcn `Tooltip`. Disabled when `pastStates.length === 0` / `futureStates.length === 0`. Buttons call `useTemporal().undo()` / `.redo()`.
- [ ] **Step 4:** Wire `useUndoRedo()` once inside `Editor.tsx`.
- [ ] **Step 5:** Manual: add 5 layers → press Cmd+Z 5× → all gone. Cmd+Shift+Z 5× → all back.
- [ ] **Step 6:** Commit: `feat(editor): undo/redo with keyboard + topbar`.

---

### Task 3: Verify ephemeral mutations are excluded

**Files:**
- Modify: `apps/web/tests/editor/store.undo.test.ts`

- [ ] **Step 1:** Add tests that exercise selection / play / scrubbing / setSaveStatus and assert `pastStates` does not grow.
- [ ] **Step 2:** If any of those DO appear in pastStates, the `partialize` configuration is wrong — the `equality` callback should compare only the project reference. Fix and re-test.
- [ ] **Step 3:** Commit: `test(editor): undo excludes ephemeral state`.

---

### Task 4: Add `@remotion/transitions` and transition mapping

**Files:**
- Modify: `packages/runtime/package.json`
- Create: `packages/runtime/src/components/transitions.tsx`, `packages/runtime/tests/components/transitions.test.tsx`

- [ ] **Step 1:** `npm install @remotion/transitions@4 -w packages/runtime`
- [ ] **Step 2:** Implement transition mapper:
  ```tsx
  import { fade, slide } from "@remotion/transitions/presets";
  import { springTiming, linearTiming } from "@remotion/transitions";
  import type { Transition } from "@open-effects/shared-types";

  export function mapTransitionToPreset(t: Transition) {
    const timing = linearTiming({ durationInFrames: t.durationFrames });
    switch (t.type) {
      case "none":          return null;
      case "fade":          return { presentation: fade(),                  timing };
      case "slide-left":    return { presentation: slide({ direction: "from-right" }), timing };
      case "slide-right":   return { presentation: slide({ direction: "from-left" }),  timing };
      case "slide-up":      return { presentation: slide({ direction: "from-bottom" }), timing };
      case "slide-down":    return { presentation: slide({ direction: "from-top" }),    timing };
    }
  }
  ```
- [ ] **Step 3:** Failing test asserts `mapTransitionToPreset` returns null for `"none"` and a non-null object with `presentation` for `"fade"`.
- [ ] **Step 4:** Commit: `feat(runtime): transition mapper`.

---

### Task 5: Refactor `OpenEffectsComposition` to use `TransitionSeries`

**Files:**
- Modify: `packages/runtime/src/OpenEffectsComposition.tsx`

- [ ] **Step 1:** Refactor:
  ```tsx
  import { AbsoluteFill } from "remotion";
  import { TransitionSeries } from "@remotion/transitions";
  import { mapTransitionToPreset } from "./components/transitions";
  // ...
  export const OpenEffectsComposition: React.FC<{ project: Project }> = ({ project }) => (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <TransitionSeries>
        {project.scenes.map((scene, i) => {
          const trans = i > 0 && scene.transitionIn ? mapTransitionToPreset(scene.transitionIn) : null;
          return (
            <React.Fragment key={scene.id}>
              {trans && <TransitionSeries.Transition presentation={trans.presentation} timing={trans.timing} />}
              <TransitionSeries.Sequence durationInFrames={scene.durationFrames}>
                <SceneRenderer scene={scene} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
  ```
- [ ] **Step 2:** Manual: open Studio's `twoScenes` fixture; modify it to add `transitionIn: { type: "fade", durationFrames: 15 }` on scene 2 → see the crossfade.
- [ ] **Step 3:** Commit: `feat(runtime): TransitionSeries-based composition`.

---

### Task 6: Update `offset.ts` for transition overlap (TDD)

**Files:**
- Modify: `packages/runtime/src/lib/offset.ts`
- Create: `packages/runtime/tests/lib/offset.transitions.test.ts`

- [ ] **Step 1:** With `TransitionSeries`, the second scene's effective start = sum of preceding scene durations MINUS sum of preceding transition overlaps. The `Transition` overlap = `transitionIn.durationFrames` of the SCENE THAT IS COMING IN (i.e. it eats the tail of the previous scene). So:
  - `sceneStartFrame(project, sceneIndex)` = sum over i in [0, sceneIndex) of `project.scenes[i].durationFrames` − sum over i in [1, sceneIndex] of `(project.scenes[i].transitionIn?.durationFrames ?? 0)` if scene[i].transitionIn != null and != "none".
  - `totalDuration(project)` = sum of all scene durations − sum of all transitionIn durations (i ≥ 1).
- [ ] **Step 2:** Failing tests:
  - 2 scenes [60, 60] no transitions → totalDuration 120.
  - 2 scenes [60, 60] with scene 2 fade 15 → totalDuration 105; sceneStartFrame(_, 1) = 45.
  - 3 scenes [30, 60, 90] with scene 2 fade 10 and scene 3 slide 20 → totalDuration 150; sceneStartFrame(_, 2) = 80.
- [ ] **Step 3:** Implement updated functions and ensure existing tests still pass.
- [ ] **Step 4:** Commit: `fix(runtime): offset accounts for transitions`.

**Note:** the editor's Timeline currently uses `selectTotalDuration` to size strips — this Stage 4-baseline now reflects transition-aware totals. Visual: scenes appear to "overlap" in the timeline by their transition duration. Acceptable v1 visual.

---

### Task 7: TransitionTab in Inspector

**Files:**
- Modify: `apps/web/src/editor/components/inspector/Inspector.tsx`
- Create: `apps/web/src/editor/components/inspector/TransitionTab.tsx`
- Modify: `apps/web/src/editor/store.ts` (add `setSceneTransition` action)

- [ ] **Step 1:** Add store action:
  ```ts
  setSceneTransition: (sceneId: string, transitionIn: Transition | null) => void;
  // impl:
  setSceneTransition: (sceneId, transitionIn) => set((s) => {
    const sc = s.project.scenes.find((x) => x.id === sceneId);
    if (sc) sc.transitionIn = transitionIn;
  })
  ```
- [ ] **Step 2:** Inspector routing:
  - If a scene is selected (no layer, no audio track) → show TransitionTab + scene props (name, duration).
  - Else as today (Stage 3/4/6).
- [ ] **Step 3:** `TransitionTab.tsx`:
  - Type select: `none`, `fade`, `slide-left`, `slide-right`, `slide-up`, `slide-down`.
  - Duration numeric input (frames).
  - Note: "Applies when this scene starts. The first scene cannot have a transition."
  - Disabled when scene index = 0.
- [ ] **Step 4:** Manual: add fade transition to scene 2; play preview → see crossfade. Render → MP4 also has crossfade.
- [ ] **Step 5:** Commit: `feat(editor): scene transitions UI`.

---

### Task 8: Form validation in NewProjectDialog + scene/layer inputs

**Files:**
- Modify: `apps/web/src/app/projects/_components/NewProjectDialog.tsx`
- Modify: `apps/web/src/editor/components/inspector/PropsTab.tsx`

- [ ] **Step 1:** Use Zod schemas already in `shared-types` to validate inputs before submit. Inline error messages under each field (red text + tooltip).
- [ ] **Step 2:** Specific rules to enforce in UI:
  - Project name: 1..100 chars, trimmed.
  - Width/height: positive integers ≤ 7680 (8K cap).
  - fps: select from {24, 30, 60} only.
  - Scene durationFrames: ≥ 1.
  - Layer name: 1..100 chars.
  - Layer startFrame ≤ endFrame; endFrame ≤ scene.durationFrames.
- [ ] **Step 3:** Manual: try invalid inputs → form refuses submit + shows errors.
- [ ] **Step 4:** Commit: `feat(editor): form validation`.

---

### Task 9: Loading + error states on API calls

**Files:**
- Modify: components that fetch (`AssetsPanel`, `ComponentsPanel`, `RenderModal`, project list page)
- Create: small reusable `<LoadingSkeleton />` and `<ErrorBlock onRetry />` primitives in `apps/web/src/components/ui/feedback.tsx`

- [ ] **Step 1:** Create the primitives (use shadcn `Skeleton`).
- [ ] **Step 2:** For each fetch call, replace bare `useEffect` with a `useState({ phase: "loading" | "error" | "ready", data, error })` pattern. Render skeleton during loading; ErrorBlock with retry on error.
- [ ] **Step 3:** Toasts on transient errors (e.g., delete failed) via `sonner` (already in Stage 3).
- [ ] **Step 4:** Commit: `feat(ui): loading + error states`.

---

### Task 10: Empty states

**Files:**
- Create: `apps/web/src/editor/components/EmptyState.tsx` (already created in Stage 1 if it was; confirm)
- Modify: `ScenesPanel`, `LayersPanel`, `AssetsPanel`, `ComponentsPanel`, KeyframesTab (no keyframes), `/projects` page

- [ ] **Step 1:** Generic `<EmptyState icon title description action?>` primitive.
- [ ] **Step 2:** Wire into each empty surface with a clear CTA:
  - Projects list: "No projects yet — Create one" → opens NewProjectDialog.
  - Scenes panel: "No scenes — Add scene" → calls `addScene`.
  - Layers panel: "No layers in this scene — Add layer" → calls `addLayer`.
  - Assets panel: "No assets uploaded — Upload" → triggers UploadButton.
  - Components panel: "No saved components — Save your first one from a layer selection".
  - KeyframesTab: "No keyframes for this property — pick a frame and add one".
- [ ] **Step 3:** Commit: `feat(ui): empty states with CTAs`.

---

### Task 11: Performance profile + memoization audit

**Files:**
- Create: `apps/web/tests/perf/computeStyles.bench.ts`
- Modify (if needed): `packages/runtime/src/keyframes/computeStylesAtFrame.ts`

- [ ] **Step 1:** Write a Vitest bench (using `bench` API or a simple `performance.now()` loop) that:
  - Generates a synthetic project with 30 layers in 1 scene, each with 50 keyframes spread across the property whitelist.
  - Calls `computeStylesAtFrame(layer.keyframes, frame, 30)` for `frame in [0..900]` (30s @ 30fps).
  - Measures total ms and average per-frame.
- [ ] **Step 2:** Acceptable target: average per-frame call (per layer) under ~1 ms — yields ~33 ms / 30 layers / frame, which fits inside 33ms budget at 30fps.
- [ ] **Step 3:** If exceeded:
  - Add a per-layer precomputed `segmentsByProperty` map (built when keyframes change) that lets `computeStylesAtFrame` look up the segment in O(log n) by frame instead of O(n) `findIndex`.
  - Cache `BezierEasing` instances in a WeakMap keyed by easing-params tuple.
- [ ] **Step 4:** Re-run bench, verify target met.
- [ ] **Step 5:** Commit: `perf(runtime): keyframe segment lookup + bezier cache (if applied)`.

---

### Task 12: Manual stress test

- [ ] **Step 1:** From the editor, build a project with 2 scenes × 30 layers each. Each layer has at least 5 animated properties × 5 keyframes (= 25 kfs/layer = 750 keyframes total per scene).
- [ ] **Step 2:** Press Play in `<Player>`. Observe: should run at ≥30fps without dropped frames.
- [ ] **Step 3:** If observably laggy, profile in browser devtools, locate the bottleneck, fix, re-measure.
- [ ] **Step 4:** Document findings in `docs/decisions/09-perf-targets.md`.
- [ ] **Step 5:** Commit: `docs(decisions): performance targets`.

---

### Task 13: Optional flushAutosave on Render

**Files:**
- Create: `apps/web/src/lib/flushAutosave.ts`
- Modify: `apps/web/src/editor/components/RenderModal.tsx`

- [ ] **Step 1:** Implement a function that triggers an immediate PATCH (cancels the debounce):
  ```ts
  export async function flushAutosave(): Promise<void> {
    const { project } = useEditorStore.getState();
    if (!project.id) return;
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project)
    });
  }
  ```
- [ ] **Step 2:** Before Render modal calls `start()`, call `await flushAutosave()`.
- [ ] **Step 3:** Commit: `feat(render): flush autosave before render`.

---

### Task 14: Renders list (small UI bonus)

**Files:**
- Create: `apps/web/src/app/projects/[id]/renders/page.tsx`
- Modify: `apps/web/src/editor/components/Topbar.tsx` (link)

- [ ] **Step 1:** Server Component that lists files under `apps/web/public/renders/<projectId>/`, sorted by mtime desc. Each row has filename, date, file size, download link, delete button.
- [ ] **Step 2:** Implement DELETE: `DELETE /api/projects/:id/renders/:filename` — validate filename matches `\d{4}-\d{2}-\d{2}T...mp4`, unlink file.
- [ ] **Step 3:** Commit: `feat(web): renders list per project`.

This is bonus polish; if time-constrained, drop to the next task.

---

### Task 15: Stage closure + final v1 acceptance pass

- [ ] **Step 1:** `npm test --workspaces --if-present` → all green across the entire monorepo.
- [ ] **Step 2:** `npm run typecheck --workspaces --if-present` → clean.
- [ ] **Step 3:** Re-run Stage 1's Quickstart from a clean clone — still under 10 minutes.
- [ ] **Step 4:** Walk through all 15 master ACs (`00-master-plan.md`), check each off:
  1. Create project with width/height/fps configurable ✓
  2. CRUD scenes + reorder + duration ✓
  3. Scene transitions ✓
  4. Layers HTML+CSS via Monaco ✓
  5. Animate the documented property whitelist ✓
  6. Easings: linear, ease-in/out, cubic-bezier, spring ✓
  7. Asset upload + reference ✓
  8. Audio: trim, move, volume keyframes (audible fade) ✓
  9. EQ static 4 bands in render ✓
  10. Saved Components ✓
  11. Live preview with scrubber ✓
  12. Render MP4 with progress + download ✓
  13. Autosave persistence on reload ✓
  14. Undo/redo for key operations ✓
  15. Audiovisual parity preview ↔ MP4 (EQ excepted) ✓
- [ ] **Step 5:** Re-create one of the existing kmpus-promo scenes from scratch using only the editor; render; visually compare against the original code-only render. The editor reproduction should look ~equivalent (acceptable for v1; pixel-perfect match not required).
- [ ] **Step 6:** Tag closure: `git commit -m "STAGE-9: closed — v1 ready"` and `git tag v1.0.0`.

---

## Test summary

| Test | Type | File |
|---|---|---|
| Undo tracks project mutations only (≥4 cases) | unit | `web/tests/editor/store.undo.test.ts` |
| Transition mapping (all 6 types) | unit (jsdom) | `runtime/tests/components/transitions.test.tsx` |
| Offset math with transitions (3 cases) | unit | `runtime/tests/lib/offset.transitions.test.ts` |
| Form validation refuses invalid inputs | manual | UI |
| Loading/error/empty states | manual | UI |
| Performance bench 30 layers × 50 keyframes | perf | `web/tests/perf/computeStyles.bench.ts` |
| Stress visual at ≥30fps | manual | browser |
| All 15 master ACs walkthrough | manual | end-to-end |

---

## Risks specific to Stage 9

| Risk | Mitigation |
|---|---|
| `zundo` adds entries for every Immer mutation, even cosmetic ones | `partialize` to `{ project }` + `equality: ref-equal` on `project` ensures only project mutations are tracked. T3 verifies. |
| Undo/redo conflicts with autosave (race: undo sets project, autosave fires PATCH) | Acceptable: undo just sets a new project value, autosave debounces and persists the result. The user sees the undone state on reload. |
| `TransitionSeries` API differences across Remotion versions | Pinned to Remotion 4 (Stage 1). The package's API has been stable in v4. |
| Transition durations longer than scene durations cause visual glitches | UI in TransitionTab clamps `durationFrames` ≤ min(this scene, prev scene) — soft validation with warning. Render still works (Remotion handles). |
| `slide` direction names (`from-right` etc.) confuse users | Labels in select use creator-facing names ("Slide left", "Slide right") with the `from-X` mapping done internally. |
| Performance bench may pass in Vitest's optimized environment but fail in browser | T12 (manual stress test) is the authoritative check. Bench is a cheap signal. |
| 8K cap on dimensions arbitrary | Documented constraint — protects against accidental huge renders. Override possible by editing the validator. |
| Renders list (T14) on disk can grow large | Acceptable for v1. T14's delete UI lets the user prune. |
| `flushAutosave` race with in-flight debounce | The function calls fetch directly; the next debounce tick will PATCH again with the same data — idempotent. No corruption risk. |
| Empty-state CTAs that depend on store state may render before hydration | Empty states themselves are fine; CTA actions work the same as the panel buttons (which already work post-hydration). |

---

## Final task checklist (execution order)

- [x] T1 — Add zundo middleware
- [x] T2 — useUndoRedo + keyboard + Topbar buttons (TDD)
- [x] T3 — Verify ephemeral mutations excluded
- [x] T4 — Add @remotion/transitions + mapper (TDD)
- [x] T5 — Refactor `OpenEffectsComposition` to TransitionSeries
- [x] T6 — Update offset math (TDD)
- [x] T7 — TransitionTab UI + setSceneTransition action
- [x] T8 — Form validation
- [x] T9 — Loading + error states
- [x] T10 — Empty states
- [x] T11 — Performance bench
- [ ] T12 — Manual stress test (deferred — requires browser)
- [x] T13 — flushAutosave on render
- [x] T14 — (bonus) renders list per project
- [ ] T15 — Stage closure + v1 acceptance pass (deferred — manual)

**Total tasks:** 15 (14 if T14 dropped) · **Estimate:** 2 weeks · **Critical risks:** transitions math (covered by T6 unit tests + manual T7), performance under stress (T11 bench + T12 visual).

---

## v1 closeout

After Stage 9 closes:
- Tag `v1.0.0`.
- Update `00-master-plan.md` with `STAGE-9 = ✅` and link to v1 changelog.
- Optional: capture a 2-minute screen recording of the marketing flow recreated end-to-end as the "v1 demo".
- Stage 10+ candidates (out of v1 scope): linked components (live references), drag/resize handles in preview, EQ dynamic over time, multi-user collaboration, Remotion Lambda for parallel renders, asset library across projects, project templates, public sharing.
