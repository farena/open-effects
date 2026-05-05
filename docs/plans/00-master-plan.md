# open-effects — Master Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution and validation. This is a **master plan** — it enumerates vertical stages with their deliverables and acceptance criteria. **Per-stage detailed task plans** (`01-foundation-stack.md`, `02-runtime-engine.md`, etc.) live in this same directory and are generated on demand, one stage at a time. Do not start implementing a stage without its corresponding detailed plan.

**Goal:** Build a visual video editor over Remotion ("open-effects") for the internal marketing team — replacing the current hand-coded flow (`kmpus-promo`, `kmpus-promo-modules`) with a UI that supports multi-project/multi-scene composition, arbitrary HTML+CSS layers animated by CSS-property keyframes, audio with fades and static EQ, MariaDB persistence, and local MP4 rendering.

**Architecture:** Monorepo (npm workspaces). `apps/web` is a Next.js 15 (App Router) full-stack app providing UI, REST API, and the render endpoint. `packages/runtime` is a standalone Remotion package exporting a universal `OpenEffectsComposition` that reads a `projectJson` via `inputProps` — the same composition is consumed by `<Player>` for live preview and by `@remotion/renderer` for MP4 output. `packages/shared-types` holds Zod schemas shared between editor and runtime, making the JSON shape the single source of truth.

**Tech Stack:** Next.js 15 (App Router) · MariaDB (existing instance on dev machine) · Prisma (provider `mysql`) · Tailwind CSS · shadcn/ui · Remotion v4 (`@remotion/player`, `@remotion/renderer`, `@remotion/bundler`, `@remotion/media`) · Monaco Editor · Zustand + Immer · DOMPurify · FFmpeg (audio EQ pre-processing).

---

## Stage overview

| # | Stage | Deliverable (one-line) | Depends on | Estimate |
|---|---|---|---|---|
| 1 | Foundation Stack | Monorepo + Next.js + MariaDB + Prisma + empty UI shell up | — | 1 wk |
| 2 | Runtime Engine (minimal) | `runtime` package renders hardcoded `projectJson` in Remotion Studio | 1 | 1.5 wk |
| 3 | CRUD + Editor base (no animation) | Create projects, edit scenes/layers/HTML/CSS, live preview, autosave | 1, 2 | 3 wk |
| 4 | Keyframe animation | Animate CSS properties with linear/cubic-bezier/spring easings | 1–3 | 2.5 wk |
| 5 | Audio (basic) | Upload audio, place on timeline, trim, hear in preview | 1–3 | 2 wk |
| 6 | Audio (volume keyframes + EQ) | Fades audible in preview; static EQ audible in MP4 | 5 | 2 wk |
| 7 | Saved Components (snapshot) | Save layers as reusable snapshots, insert across projects | 1–4 | 1.5 wk |
| 8 | MP4 render from UI | Render button → progress → downloadable MP4 | 1–6 | 1.5 wk |
| 9 | Polish (undo/redo + scene transitions + edge cases) | Production-quality v1 | 1–8 | 2 wk |

**Total: ~17 weeks (1 dev)** or ~9–11 weeks with 2 devs working in parallel where dependencies allow (e.g., Stage 5 audio can start in parallel with Stage 4 once Stage 3 is closed).

Each stage is **independently demoable and tested** — do not move forward to stage N+1 until stage N's acceptance criteria are signed off.

---

## Stage 1 — Foundation Stack

**Objective.** Bootstrap the monorepo, wire up MariaDB, expose the empty UI shell.

**Deliverable.** A new dev clones the repo, fills `.env` with credentials for the existing MariaDB instance, runs `npm install && npm run db:migrate && npm run dev`, and within 10 minutes sees `http://localhost:3000` showing the landing page and `/projects` showing an empty list with a (disabled) "New project" button.

**Acceptance criteria**
1. Monorepo structure exists: `apps/web/`, `packages/runtime/`, `packages/shared-types/`, root `package.json` with workspaces.
2. `.env.example` documents the credentials needed to connect to the existing MariaDB instance (no Docker Compose — DB is preprovisioned on the dev machine).
3. `apps/web/prisma/schema.prisma` declares all v1 models (`Project`, `Scene`, `Layer`, `Keyframe`, `AudioTrack`, `VolumeKeyframe`, `Asset`, `SavedComponent`) with `provider = "mysql"`. Initial migration committed and applies cleanly.
4. Next.js 15 (App Router) scaffolded with Tailwind, shadcn/ui base, and TypeScript strict mode.
5. Routes exist: `/` (landing) and `/projects` (empty list). Both return 200.
6. `README.md` documents prerequisites (Node version, npm, an accessible MariaDB instance, FFmpeg installed locally), setup steps, and common scripts.

**Tests required to close stage**
- Unit: Prisma client connects (smoke test: `prisma.$connect()` resolves).
- Integration: `GET /api/projects` returns `[]` against fresh DB.
- Manual: clean-clone bootstrap by another dev under 10 minutes.

**Dependencies.** None.

**Estimate.** 1 week.

---

## Stage 2 — Runtime Engine (minimal)

**Objective.** Build the universal Remotion composition that reads a `projectJson` and renders it. This is the engine both `<Player>` and `renderMedia` will consume from Stage 3 onward.

**Deliverable.** `npm run studio -w packages/runtime` opens Remotion Studio with a hardcoded `projectJson` fixture rendering one scene with one HTML+CSS layer (static, no animation yet). Editing the fixture in code and reloading Studio reflects the change. Width/height/fps come from the JSON.

**Acceptance criteria**
1. `packages/runtime` is independently buildable (`remotion.config.ts`, `tsconfig.json`, own `package.json`).
2. `OpenEffectsComposition` accepts `inputProps: { project: ProjectJson }` and renders all scenes via `<Sequence>` with computed `from`/`durationInFrames`.
3. `Layer` component renders arbitrary HTML+CSS inside an isolated container (`contain: strict` + scoped CSS prefixed with `[data-layer-id]`) to prevent leakage to the editor chrome.
4. HTML is sanitized via DOMPurify before injection (block `<script>`, event handlers, etc.).
5. `packages/shared-types` exports Zod schemas for `ProjectJson`, `SceneJson`, `LayerJson`, `KeyframeJson`, `AudioTrackJson`. Both `apps/web` and `packages/runtime` import from here.
6. Composition resolution and fps come from the project JSON (configurable, not hardcoded).
7. Sample fixtures live in `packages/runtime/fixtures/` for visual verification and snapshot tests.

**Tests required to close stage**
- Unit: Zod schema validation (valid + invalid fixtures, ≥4 cases each).
- Unit: scene-offset calculator (`offsetOf(project, sceneIndex)`).
- Snapshot: `OpenEffectsComposition` rendered headlessly with sample fixture (visual diff via Remotion still rendering).
- Manual: open in Remotion Studio, verify rendering matches fixture.

**Dependencies.** Stage 1 (needs the workspace + `shared-types` package).

**Estimate.** 1.5 weeks.

---

## Stage 3 — CRUD + Editor base (no animation)

**Objective.** Full editor UI usable for static composition. Scenes/layers persist. Live preview works. Animation arrives in Stage 4.

**Deliverable.** User creates a project, opens the editor, adds/removes/reorders scenes and layers, edits HTML and CSS in Monaco panels, sees changes reflected in `<Player>` in real time. Closing the browser and returning shows everything intact (autosave).

**Acceptance criteria**
1. REST endpoints under `/api/projects`: `POST` (create), `GET` (list and detail), `PATCH` (full update / partial), `DELETE`.
2. Editor page `/projects/:id` with 3-panel layout: left sidebar (Layers + Assets tabs), center (`<Player>` + scrubber + play/pause), right inspector (Props + HTML + CSS tabs), bottom timeline strip (scenes + layers).
3. Scenes: add, delete, drag-reorder, set `durationFrames` from inspector.
4. Layers: add, delete, drag-reorder (z-index), select. New layers default to a minimal HTML+CSS template.
5. Inspector tabs HTML and CSS use Monaco with the corresponding language mode.
6. Zustand store holds editing state; `<Player>` re-renders on store change via `inputProps`.
7. Autosave: 1s debounce after any state change, sends `PATCH /api/projects/:id` with serialized projectJson.
8. Reload of the editor page restores the exact state from DB.

**Tests required to close stage**
- Unit: store reducers (add/remove/reorder for scenes and layers).
- Integration: API CRUD round-trip (create → read → update → delete).
- Integration: autosave triggers `PATCH` after debounce window.
- Manual: create project, add 3 scenes × 2 layers each, reload, verify integrity.

**Dependencies.** Stages 1, 2.

**Estimate.** 3 weeks.

---

## Stage 4 — Keyframe animation

**Objective.** Make CSS properties animatable via keyframes, with the full easing set including spring.

**Deliverable.** User selects a layer, selects a frame, picks an animatable property, captures the current value as a keyframe. Adds another keyframe at a different frame with a different value. Picks an easing (linear / ease-in / ease-out / ease-in-out / cubic-bezier custom / spring). Plays preview and sees the animation.

**Acceptance criteria**
1. Whitelist of animatable properties documented and enforced: `opacity`, `transform.translateX`, `transform.translateY`, `transform.scale`, `transform.rotate`, `color`, `background-color`, `border-radius`, `width`, `height`, `top`, `left`.
2. `computeStylesAtFrame(keyframes, frame)` interpolates correctly for numeric, color (rgba), and compound transform values. (Spike with `popmotion mix()` to validate non-numeric coverage; if insufficient, document the property-typed mini-parser approach in the per-stage plan.)
3. Keyframe segment easings supported: `linear`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier(p1,p2,p3,p4)` with custom params, `spring({ damping, stiffness, mass })`.
4. Spring is implemented via Remotion `spring()` with `durationInFrames = kfB.frame - kfA.frame` and remapped to a 0→1 interpolator between the two keyframe values.
5. Inspector "Keyframes" tab lists all keyframes per property; supports add at current frame, delete, edit value, edit easing.
6. Timeline shows keyframe dots per layer; drag a dot to change `frame`.
7. Preview animates in real time on scrub or play.
8. Keyframes persist to DB (Stage 3 autosave continues to work).

**Tests required to close stage**
- Unit: each easing function (linear, cubic-bezier, spring) — verify endpoints and intermediate values.
- Unit: color (rgba) interpolation, transform compound interpolation, numeric interpolation.
- Unit: `computeStylesAtFrame` with multi-property fixture (≥3 properties × ≥3 keyframes each).
- Integration: keyframe CRUD via API.
- Manual: animate `opacity` 0→1 with spring between frames 0 and 30; visually confirm overshoot.

**Dependencies.** Stages 1–3.

**Estimate.** 2.5 weeks.

---

## Stage 5 — Audio (basic)

**Objective.** Add audio assets to scenes with trim and timeline placement, audible in preview.

**Deliverable.** User uploads an mp3 from the Assets sidebar, drags it onto a scene as an `AudioTrack`, trims start/end, moves it on the timeline, presses play, and hears it in sync with the visuals.

**Acceptance criteria**
1. `POST /api/assets` accepts file uploads (image/audio/video) with mime-type validation, stores in `apps/web/public/assets/`, persists `Asset` row.
2. `GET /api/assets` lists assets filterable by `type`.
3. Sidebar Assets tab displays uploaded assets; clicking an audio asset adds an `AudioTrack` to the active scene.
4. `AudioTrack` model fields wired in editor: `startFrame`, `trimStart`, `trimEnd`.
5. Timeline shows audio strip with rendered waveform (use `wavesurfer.js` or canvas-based renderer).
6. Drag the body of the strip to reposition; drag edges to trim.
7. `<Audio>` from `@remotion/media` plays the source with `trimStart`/`trimEnd` props in `<Player>`.

**Tests required to close stage**
- Unit: AudioTrack reducer ops (add, trim, move).
- Integration: upload + reference round-trip (file written to disk, asset listed, AudioTrack persisted).
- Manual: upload mp3, place at frame 0 of scene 1, scrub timeline, verify audible playback.

**Dependencies.** Stages 1–3 (does NOT depend on Stage 4 — can be developed in parallel).

**Estimate.** 2 weeks.

---

## Stage 6 — Audio (volume keyframes + static EQ)

**Objective.** Audio expressiveness: fades via volume keyframes + per-track 4-band EQ.

**Deliverable.** User adds volume keyframes to an audio track and hears the fade in/out in `<Player>`. User configures EQ (low/mid/high/presence in dB) and renders the project; the MP4's audio reflects the EQ.

**Acceptance criteria**
1. `VolumeKeyframe` model with `frame`, `value` (0..1), `easingOut` (reuses Stage 4 easing schema).
2. `<Audio volume={(f) => evalVolumeKeyframes(track, f)}>` wired in `<Player>`; fades audible in preview.
3. Inspector tab "Audio FX" with 4 EQ bands (low ~80Hz, mid ~1kHz, high ~5kHz, presence ~10kHz), gain in dB, sliders + numeric input.
4. Render-time EQ pipeline (`apps/web/lib/audio/processEq.ts`) shells out to FFmpeg with `equalizer` filters per band.
5. Cache key = `SHA256(${assetSha}:${trimStart}:${trimEnd}:${stableJsonStringify(eq)})`. Cached files in `apps/web/.cache/audio/`.
6. Render uses processed audio path; preview uses raw (limitation documented in editor UI as "EQ applied at render only").
7. EQ bypass works (when all gains = 0, no FFmpeg processing — pass raw asset through).

**Tests required to close stage**
- Unit: cache key determinism (same inputs → same hash; reorder of `eq` keys → same hash).
- Unit: FFmpeg argv builder (verify expected filter chain for given EQ).
- Integration: volume keyframe round-trip; EQ cache hit (second call doesn't re-process).
- Manual: configure 1s fade in + presence boost +6dB; render and verify by ear.

**Dependencies.** Stage 5; FFmpeg installed locally (documented in README from Stage 1).

**Estimate.** 2 weeks.

---

## Stage 7 — Saved Components (snapshot)

**Objective.** Reusability without coupling: save layer groups as snapshot components.

**Deliverable.** User selects 1+ layers, clicks "Save as component", names it, sees it in the Components sidebar. Opens another project, drags the component into a scene; it appears as new layers with frames re-based to the current frame and identical animation behavior.

**Acceptance criteria**
1. `SavedComponent` model with `name`, `category`, `preview` (optional thumbnail path), `payload` (JSON snapshot of layers + keyframes, frames normalized to 0).
2. `POST /api/components` saves selected layers as a deep snapshot; `GET /api/components` lists; `DELETE` removes.
3. Sidebar Components tab with grid + thumbnails.
4. Insert via click (target = active scene + currentFrame) or drag-onto-canvas.
5. On insert: deep-clone payload, generate fresh IDs for layers and keyframes, re-base all `startFrame`/`endFrame`/keyframe `frame` to `+ currentFrame`.
6. Cross-project insertion verified (component saved in project A appears and works in project B).
7. Optional thumbnail capture on save (still-render of layers at frame 0).

**Tests required to close stage**
- Unit: payload normalization (frames → 0-based on save), frame re-basing on insert.
- Unit: ID regeneration ensures no collision with existing scene layers.
- Integration: save in project A, list, insert in project B, verify identical animation.
- Manual: save an animated layer (with spring keyframes), insert in fresh project, play.

**Dependencies.** Stages 1–4 (uses keyframes).

**Estimate.** 1.5 weeks.

---

## Stage 8 — MP4 render from UI

**Objective.** Closed loop: edit in UI → MP4 file on disk.

**Deliverable.** User clicks "Render" in the topbar. Progress bar updates in real time. On completion, a download link appears for the generated MP4. The MP4 plays correctly with all visual + audio layers as previewed (modulo EQ which only exists in render).

**Acceptance criteria**
1. `POST /api/render/:projectId` accepts a render request; assembles `projectJson` from DB.
2. Server-side render uses `@remotion/bundler` + `@remotion/renderer` with `inputProps: { project }`.
3. Composition resolution = `project.width × project.height`, fps = `project.fps`, total duration = sum of scene durations + transition overlaps.
4. Output written to `apps/web/public/renders/:projectId/:timestamp.mp4`.
5. Progress streamed via SSE endpoint or short-poll endpoint (≥10% granularity).
6. UI shows "Rendering" state with progress; "Complete" state with download button.
7. Errors (missing asset, FFmpeg failure, render exception) surface with clear messages — no silent failures.
8. Audio EQ pre-processing (Stage 6) integrates: render builds processed audio paths before invoking `renderMedia`.

**Tests required to close stage**
- Unit: render input builder (`buildProjectJsonForRender(projectId)` against fixture DB).
- Integration: smoke render of minimal project (1 scene, 1 static layer) — verify MP4 file exists, has correct duration via ffprobe.
- Manual: render demo project (multi-scene + animated layers + audio with fade + EQ), play in VLC, verify.

**Dependencies.** Stages 1–6 (everything authored before this gets consumed in a render).

**Estimate.** 1.5 weeks.

---

## Stage 9 — Polish (undo/redo + scene transitions + edge cases)

**Objective.** Move from "works" to "shippable v1" — undo/redo, scene transitions, validation, error handling.

**Deliverable.** Operations are reversible (undo/redo). Transitions between scenes (fade/slide/none) are configurable in the inspector and visible in both preview and render. Empty/error/loading states are explicit. The app handles a 30-layer × 50-keyframes scene without dropping preview frames.

**Acceptance criteria**
1. Zustand store integrates Immer patches; undo/redo tracks: add/remove layer, move keyframe, edit HTML/CSS, change keyframe value, add/remove scene, change scene duration.
2. Keyboard shortcuts: `Cmd/Ctrl+Z` undo, `Cmd/Ctrl+Shift+Z` redo (cross-platform).
3. Scene transitions: `none`, `fade`, `slide-left`, `slide-right`, `slide-up`, `slide-down`. Duration configurable (default 15 frames).
4. Transitions render identically in preview and in MP4 (use `@remotion/transitions` or hand-rolled in `OpenEffectsComposition`).
5. Form validation: project name required, dimensions are positive integers, fps in {24, 30, 60}.
6. Loading states on every API call; error toasts on failure.
7. Empty states for: no projects, no scenes in project, no layers in scene, no keyframes on layer.
8. Performance target: project with 30 layers/scene + 50 keyframes/layer maintains ≥30fps in `<Player>` on a typical dev machine. Memoize `computeStylesAtFrame` per layer per frame range.

**Tests required to close stage**
- Unit: undo/redo for each tracked operation.
- Unit: transition timing math (overlap correctness).
- Integration: full project lifecycle (create → scenes → layers → keyframes → audio → render).
- Performance: scripted 30×50 stress test, measure preview fps.
- Manual: 15-minute end-to-end session reproducing a real marketing flow (replicate one existing kmpus-promo style video from scratch using only the editor).

**Dependencies.** Stages 1–8.

**Estimate.** 2 weeks.

---

## Global acceptance criteria mapping (v1 → stages)

| AC | Description | Stage |
|---|---|---|
| 1 | Project with width/height/fps configurable | 3 |
| 2 | CRUD scenes + reorder + duration | 3 |
| 3 | Scene transitions (fade, slide, none) | 9 |
| 4 | Layers HTML+CSS via Monaco | 3 |
| 5 | Animate opacity, transform, color, bg-color, border-radius, w/h/top/left | 4 |
| 6 | Easings linear, ease-in/out, cubic-bezier, spring | 4 |
| 7 | Upload assets and reference (HTML img / AudioTrack) | 5 |
| 8 | Audio: trim, move, volume keyframes (audible fade) | 5 + 6 |
| 9 | EQ static 4 bands in render | 6 |
| 10 | Saved Components (snapshot) | 7 |
| 11 | Live preview with scrubber | 3 |
| 12 | Render MP4 with progress + download | 8 |
| 13 | Autosave persistence on reload | 3 |
| 14 | Undo/redo for key operations | 9 |
| 15 | Audiovisual parity preview ↔ MP4 (EQ excepted) | 8 |

**Coverage check:** every AC maps to at least one stage. ✅

---

## Cross-cutting risks and mitigations

| Risk | Severity | Surfaces in stage | Mitigation |
|---|---|---|---|
| Interpolation of non-numeric CSS values (colors, compound transform, filter) | High | 4 | Spike days 1–3 of Stage 4 with `popmotion mix()`. If insufficient, fall back to property-typed mini-parser. Whitelist of supported properties is enforced; unsupported properties fail with a clear error when keyframe is added. |
| Arbitrary HTML/CSS in layers breaks editor chrome | Medium | 2 | Layer container with `contain: strict`; CSS scoped by prefixing all selectors with `[data-layer-id="..."]`; HTML sanitized via DOMPurify. |
| EQ pre-processing cache invalidation / disk growth | Medium | 6 | Deterministic SHA256 cache key over `(assetSha, trim, eqParams)`; cleanup script removes entries unused for >30 days (manual cron / startup task). |
| Player performance with many layers / keyframes | Medium | 4, 9 | Memoize `computeStylesAtFrame` per layer; document targets (≤30 layers/scene, ≤50 keyframes/layer); performance test in Stage 9. |
| Spring needs `durationInFrames` to bound oscillation | Low | 4 | Pass `durationInFrames = kfB.frame - kfA.frame` to Remotion `spring()`; covered in Stage 4 unit tests. |
| Autosave + concurrent edits in same browser tab (drag in flight when debounce fires) | Low | 3 | Autosave sends serialized snapshot of current store state, not diff. Drag operations commit to store on drag end, not during. |
| MariaDB JSON column query ergonomics weaker than Postgres jsonb | Low | 1, 6 | Acceptable for v1: queries on JSON fields are rare (mostly read-whole-project). If a future feature needs deep JSON queries, evaluate moving specific fields to relational columns. |
| FFmpeg not installed on dev/render machine | Low | 1, 6, 8 | Documented in README from Stage 1. Render endpoint fails-fast with clear "FFmpeg not found" error. |

---

## Project conventions

- **Package manager:** npm with workspaces (`apps/*`, `packages/*`). Lock to a specific version in `package.json` `packageManager` field.
- **Node version:** pinned in `.nvmrc` (Node 20 LTS or newer).
- **TypeScript:** strict mode everywhere; no `any` without justification comment.
- **Naming:** kebab-case for file names, PascalCase for React components, camelCase for variables/functions.
- **Tests:** Vitest in `apps/web` (Next.js compatible); Vitest in `packages/runtime` for runtime/interpolator tests; Playwright reserved for end-to-end manual scenarios in Stage 9 if needed.
- **Schema source of truth:** `packages/shared-types` (Zod). Both Prisma (storage) and runtime (rendering) align to these schemas.
- **Commit cadence:** one commit per closed task within a stage; stage closure commit includes a `STAGE-N: closed` tag in the message.
- **Per-stage branch model (suggested):** `stage-N-<slug>` branch off `main`, merged after acceptance criteria are signed off.

---

## Próximos pasos

This master plan covers the **what** of each stage. The **how** — file paths, exact tasks, TDD steps, commands — lives in per-stage detailed plans, each generated on demand:

- `docs/plans/01-foundation-stack.md`
- `docs/plans/02-runtime-engine.md`
- `docs/plans/03-crud-editor-base.md`
- `docs/plans/04-keyframe-animation.md`
- `docs/plans/05-audio-basic.md`
- `docs/plans/06-audio-keyframes-eq.md`
- `docs/plans/07-saved-components.md`
- `docs/plans/08-mp4-render.md`
- `docs/plans/09-polish.md`

When ready to start a stage, ask the planner to generate its detailed plan. Each per-stage plan will follow the standard `write-plan` task template with TDD steps and exact file paths, and will reference back to the stage's acceptance criteria from this master document.

**Recommended kickoff order:** generate `01-foundation-stack.md` next — it unblocks every other stage and is small enough to validate the whole tooling pipeline (workspaces, Prisma, MariaDB, scripts) end-to-end before committing to bigger stages.
