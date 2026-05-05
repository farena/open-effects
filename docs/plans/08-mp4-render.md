# Stage 8 — MP4 render from UI Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read all prior plans first. Stage 8 closes the loop: edit → MP4 file. Reuses the `OpenEffectsComposition` from Stage 2, the project JSON shape from Stage 3, the keyframe interpolators from Stage 4, the audio infrastructure from Stages 5/6 (including `processEq` from Stage 6), and the saved components from Stage 7 (rendered as plain layers — no special handling).

**Goal:** User clicks "Render" in the editor topbar. A modal shows a progress bar that updates in real time. On completion, a download button appears that returns the MP4. The MP4 plays correctly with all visuals + audio (volume keyframes audible; EQ audible because Stage 6's `processEq` is applied before `renderMedia`).

**Architecture:** A `POST /api/render/:projectId` endpoint creates a `renderId` (cuid), stores a record in an in-memory registry, kicks off the async render in a background promise, and returns immediately with `{ renderId }`. The client opens a Server-Sent Events stream at `GET /api/render/:projectId/:renderId/events` to receive progress and the final output URL. The render itself: (1) hydrates `Project` from DB via `toProjectJson` from Stage 3, (2) for each `AudioTrack` calls `processEq` (Stage 6) and substitutes `assetPath` with a `file://` URL of the resolved (raw or EQ'd) file, (3) bundles `packages/runtime` via `@remotion/bundler` (cached across renders), (4) calls `selectComposition` + `renderMedia` (with `onProgress` updating the registry), (5) writes output to `apps/web/public/renders/:projectId/:timestamp.mp4`. The bundle is built once per process and re-used; restarting the server triggers a re-bundle on next render.

**Tech Stack additions:** `@remotion/bundler`, `@remotion/renderer` (already in `packages/runtime`'s dev deps from Stage 2 — promote to `apps/web` runtime deps now). No new external libraries.

---

## Acceptance criteria → tasks map (Stage 8 master ACs)

| Master AC | Tasks |
|---|---|
| 1. `POST /api/render/:projectId` builds `Project` JSON from DB | T1, T5 |
| 2. Bundle + render via Remotion APIs | T3, T4 |
| 3. Width/height/fps/duration come from project | T1 |
| 4. Output to `public/renders/:projectId/:timestamp.mp4` | T4 |
| 5. Progress streamed (SSE) | T6, T7 |
| 6. UI render-in-progress + complete + download | T8, T9 |
| 7. Errors surface clearly | T7, T8 |
| 8. EQ pre-process integrated | T2, T4 |

---

## File structure to create

```
apps/web/
├── package.json                              # MODIFY: add @remotion/bundler + @remotion/renderer to deps
├── src/
│   ├── lib/
│   │   ├── render/
│   │   │   ├── buildRenderProject.ts         # NEW: hydrate + EQ-resolve audio
│   │   │   ├── assetResolver.ts              # NEW: /assets/x → /abs/file/path
│   │   │   ├── bundleCache.ts                # NEW: lazily bundle once per process
│   │   │   ├── renderRegistry.ts             # NEW: in-memory job state
│   │   │   ├── renderJob.ts                  # NEW: orchestrator
│   │   │   └── outputPath.ts                 # NEW: writes under public/renders/...
│   ├── editor/
│   │   ├── components/
│   │   │   ├── Topbar.tsx                    # MODIFY: enable Render button
│   │   │   └── RenderModal.tsx               # NEW: progress + download UI
│   │   └── useRender.ts                      # NEW: kick off + subscribe SSE
│   └── app/
│       └── api/render/
│           ├── route.ts                      # POST :projectId disabled? See T5 routing
│           └── [projectId]/
│               ├── route.ts                  # POST → kicks off renderJob
│               └── [renderId]/
│                   └── events/route.ts       # GET (SSE)
└── tests/
    └── lib/render/
        ├── buildRenderProject.test.ts        # NEW
        ├── assetResolver.test.ts             # NEW
        └── renderRegistry.test.ts            # NEW

packages/runtime/
├── src/
│   └── Root.tsx                               # MODIFY: register a "Project" composition that reads inputProps
                                               #   so @remotion/bundler can find it by id "Project"
```

---

## Task list (execution order)

### Task 1: `buildRenderProject` (TDD)

**Files:**
- Create: `apps/web/src/lib/render/buildRenderProject.ts`, `tests/lib/render/buildRenderProject.test.ts`

- [ ] **Step 1:** Failing tests:
  - Calls `toProjectJson(projectId)` and returns the result with audio asset paths replaced by `file://` URLs (T2 wires the resolver).
  - Throws if the project doesn't exist.
  - Returns `{ project, totalDurationFrames }` for use by selectComposition.
- [ ] **Step 2:** Implement (depends on T2 below — write Stub here, complete after T2):
  ```ts
  import { toProjectJson } from "@/lib/persistence/toProjectJson";
  import { resolveAssetForRender } from "./assetResolver";
  import { processEq } from "@/lib/audio/processEq";
  import type { Project } from "@open-effects/shared-types";

  export async function buildRenderProject(projectId: string): Promise<{ project: Project; totalDurationFrames: number }> {
    const project = await toProjectJson(projectId);
    // Resolve asset paths + EQ for each audio track
    for (const sc of project.scenes) {
      for (const t of sc.audioTracks) {
        const inputAbsPath = resolveAssetForRender(t.assetPath);
        // Compute SHA from the original filename via DB? — easier: store sha in toProjectJson output. Adjust.
        // For now, compute from filesystem (read+hash would re-hash; better: include sha in the AudioTrack JSON via Stage 3 hydrator).
        const processed = await processEq({
          inputAbsPath,
          assetSha256: t.assetSha256!, // see note below
          eq: t.eq ?? null
        });
        t.assetPath = `file://${processed}`;
      }
    }
    const totalDurationFrames = project.scenes.reduce((acc, sc) => acc + sc.durationFrames, 0);
    return { project, totalDurationFrames };
  }
  ```
- [ ] **Step 3:** Tests pass (mock `processEq` to return input unchanged).
- [ ] **Step 4:** Commit: `feat(render): buildRenderProject`.

**Schema gap to fix in this task:** `AudioTrackSchema` from Stage 2 doesn't include `assetSha256`. Add it as an optional field (`assetSha256: z.string().optional()`) and update Stage 3's `toProjectJson` to populate it from `t.asset.sha256`. Update tests in shared-types and persistence accordingly. **One commit chain:** add the field, update hydrator, update buildRenderProject. Do NOT add it to writes (`persistProjectJson`) — it's a derived field for render only and is dropped on save.

---

### Task 2: Asset resolver

**Files:**
- Create: `apps/web/src/lib/render/assetResolver.ts`, `tests/lib/render/assetResolver.test.ts`

- [ ] **Step 1:** Failing tests:
  - `/assets/abc.mp3` → `<projectCwd>/public/assets/abc.mp3` (absolute path).
  - Path traversal (`../`) is rejected (return null or throw).
  - Non-`/assets/` URLs are passed through unchanged (e.g., already `file://...`).
- [ ] **Step 2:** Implement:
  ```ts
  import path from "node:path";

  export function resolveAssetForRender(publicPath: string): string {
    if (publicPath.startsWith("file://") || /^https?:\/\//.test(publicPath)) return publicPath;
    if (!publicPath.startsWith("/assets/")) {
      throw new Error(`Unexpected asset path: ${publicPath}`);
    }
    if (publicPath.includes("..")) throw new Error("Path traversal blocked");
    return path.resolve(process.cwd(), "public", publicPath.replace(/^\//, ""));
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(render): asset path resolver`.

---

### Task 3: Bundle cache

**Files:**
- Create: `apps/web/src/lib/render/bundleCache.ts`

- [ ] **Step 1:** Promote `@remotion/bundler` and `@remotion/renderer` to `apps/web` runtime deps:
  `npm install @remotion/bundler @remotion/renderer -w apps/web`
- [ ] **Step 2:** Implement (singleton, lazily bundles, returns the bundle URL):
  ```ts
  import { bundle } from "@remotion/bundler";
  import path from "node:path";

  let bundleUrl: string | null = null;
  let inFlight: Promise<string> | null = null;

  export async function getBundleUrl(): Promise<string> {
    if (bundleUrl) return bundleUrl;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const entry = path.resolve(process.cwd(), "../../packages/runtime/src/Root.tsx");
      const result = await bundle({
        entryPoint: entry,
        // webpackOverride could add aliases for monorepo if needed
      });
      bundleUrl = result;
      inFlight = null;
      return result;
    })();
    return inFlight;
  }
  ```
- [ ] **Step 3:** Verify path resolution from `apps/web/`'s working directory.
- [ ] **Step 4:** Commit: `feat(render): bundle cache`.

**Note:** the first render in any process pays the bundling cost (~10-30s). Subsequent renders reuse. If `packages/runtime/src/*` changes, the user must restart the dev server (documented behavior; out of scope for hot-bundling in v1).

---

### Task 4: Render registry + render job

**Files:**
- Create: `apps/web/src/lib/render/renderRegistry.ts`, `tests/lib/render/renderRegistry.test.ts`, `apps/web/src/lib/render/renderJob.ts`, `apps/web/src/lib/render/outputPath.ts`

- [ ] **Step 1:** Failing tests for registry:
  - `create(jobInit)` returns id; `get(id)` returns the job.
  - `update(id, patch)` merges partial state.
  - `subscribe(id, listener)` receives events on update; unsubscribe stops.
- [ ] **Step 2:** Implement registry:
  ```ts
  import { newId } from "@/lib/ids";

  export type RenderJob = {
    id: string;
    projectId: string;
    status: "queued" | "bundling" | "rendering" | "completed" | "error";
    progress: number;          // 0..1
    outputUrl?: string;        // /renders/:projectId/:timestamp.mp4
    error?: string;
    startedAt: number;
    finishedAt?: number;
  };

  type Listener = (job: RenderJob) => void;
  const jobs = new Map<string, RenderJob>();
  const subs = new Map<string, Set<Listener>>();

  export const renderRegistry = {
    create(projectId: string): RenderJob {
      const job: RenderJob = { id: newId(), projectId, status: "queued", progress: 0, startedAt: Date.now() };
      jobs.set(job.id, job); subs.set(job.id, new Set());
      return job;
    },
    get(id: string) { return jobs.get(id); },
    update(id: string, patch: Partial<RenderJob>) {
      const cur = jobs.get(id); if (!cur) return;
      const next = { ...cur, ...patch };
      jobs.set(id, next);
      subs.get(id)?.forEach((l) => l(next));
    },
    subscribe(id: string, listener: Listener) {
      const set = subs.get(id);
      if (!set) return () => {};
      set.add(listener);
      return () => set.delete(listener);
    }
  };
  ```
- [ ] **Step 3:** Implement `outputPath.ts`:
  ```ts
  import path from "node:path";
  import { mkdir } from "node:fs/promises";

  export async function ensureOutputDir(projectId: string): Promise<{ absDir: string; publicDir: string }> {
    const publicDir = `/renders/${projectId}`;
    const absDir = path.resolve(process.cwd(), "public/renders", projectId);
    await mkdir(absDir, { recursive: true });
    return { absDir, publicDir };
  }

  export function timestampedFilename(): string {
    const t = new Date().toISOString().replace(/[:.]/g, "-");
    return `${t}.mp4`;
  }
  ```
- [ ] **Step 4:** Implement `renderJob.ts`:
  ```ts
  import path from "node:path";
  import { selectComposition, renderMedia } from "@remotion/renderer";
  import { getBundleUrl } from "./bundleCache";
  import { buildRenderProject } from "./buildRenderProject";
  import { ensureOutputDir, timestampedFilename } from "./outputPath";
  import { renderRegistry } from "./renderRegistry";

  /** Composition id registered in packages/runtime/src/Root.tsx (T8 below) */
  const COMPOSITION_ID = "Project";

  export async function runRenderJob(jobId: string, projectId: string) {
    try {
      renderRegistry.update(jobId, { status: "bundling" });
      const serveUrl = await getBundleUrl();

      const { project, totalDurationFrames } = await buildRenderProject(projectId);

      const composition = await selectComposition({
        serveUrl,
        id: COMPOSITION_ID,
        inputProps: { project }
      });

      const { absDir, publicDir } = await ensureOutputDir(projectId);
      const filename = timestampedFilename();
      const outputLocation = path.join(absDir, filename);

      renderRegistry.update(jobId, { status: "rendering" });

      await renderMedia({
        serveUrl,
        composition: {
          ...composition,
          width: project.width,
          height: project.height,
          fps: project.fps,
          durationInFrames: Math.max(1, totalDurationFrames)
        },
        codec: "h264",
        outputLocation,
        inputProps: { project },
        onProgress: ({ progress }) => {
          renderRegistry.update(jobId, { progress });
        }
      });

      renderRegistry.update(jobId, {
        status: "completed",
        progress: 1,
        outputUrl: `${publicDir}/${filename}`,
        finishedAt: Date.now()
      });
    } catch (e: any) {
      renderRegistry.update(jobId, {
        status: "error",
        error: e?.message ?? String(e),
        finishedAt: Date.now()
      });
    }
  }
  ```
- [ ] **Step 5:** Tests pass.
- [ ] **Step 6:** Commit: `feat(render): registry + job orchestrator`.

---

### Task 5: `POST /api/render/:projectId` endpoint

**Files:**
- Create: `apps/web/src/app/api/render/[projectId]/route.ts`

- [ ] **Step 1:** Implement:
  ```ts
  import { NextResponse } from "next/server";
  import { renderRegistry } from "@/lib/render/renderRegistry";
  import { runRenderJob } from "@/lib/render/renderJob";
  import { db } from "@/lib/db";

  export async function POST(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const job = renderRegistry.create(projectId);
    // Fire-and-forget; SSE stream conveys progress
    runRenderJob(job.id, projectId).catch(() => { /* state already updated by registry */ });
    return NextResponse.json({ renderId: job.id }, { status: 202 });
  }
  ```
- [ ] **Step 2:** Manual: `curl -X POST http://localhost:3000/api/render/<projectId>` → returns `{ renderId }`.
- [ ] **Step 3:** Commit: `feat(api): POST /api/render/:projectId`.

---

### Task 6: SSE endpoint `GET /api/render/:projectId/:renderId/events`

**Files:**
- Create: `apps/web/src/app/api/render/[projectId]/[renderId]/events/route.ts`

- [ ] **Step 1:** Implement:
  ```ts
  import { renderRegistry } from "@/lib/render/renderRegistry";

  export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string; renderId: string }> }) {
    const { renderId } = await params;
    const initial = renderRegistry.get(renderId);
    if (!initial) return new Response("not_found", { status: 404 });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (job: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(job)}\n\n`));
          if (job.status === "completed" || job.status === "error") {
            controller.close();
            unsub();
          }
        };
        send(initial);
        const unsub = renderRegistry.subscribe(renderId, send);
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });
  }
  ```
- [ ] **Step 2:** Manual: `curl -N http://localhost:3000/api/render/<pid>/<rid>/events` → streams `data:` lines until completion.
- [ ] **Step 3:** Commit: `feat(api): SSE render progress`.

---

### Task 7: `useRender` hook (client)

**Files:**
- Create: `apps/web/src/editor/useRender.ts`

- [ ] **Step 1:** Implement:
  ```ts
  "use client";
  import { useState, useCallback } from "react";

  export type RenderState =
    | { phase: "idle" }
    | { phase: "starting" }
    | { phase: "running"; renderId: string; progress: number; status: string }
    | { phase: "done"; outputUrl: string }
    | { phase: "error"; error: string };

  export function useRender(projectId: string) {
    const [state, setState] = useState<RenderState>({ phase: "idle" });
    const start = useCallback(async () => {
      setState({ phase: "starting" });
      const res = await fetch(`/api/render/${projectId}`, { method: "POST" });
      if (!res.ok) { setState({ phase: "error", error: await res.text() }); return; }
      const { renderId } = await res.json();
      setState({ phase: "running", renderId, progress: 0, status: "queued" });

      const es = new EventSource(`/api/render/${projectId}/${renderId}/events`);
      es.onmessage = (ev) => {
        const job = JSON.parse(ev.data);
        if (job.status === "completed") {
          setState({ phase: "done", outputUrl: job.outputUrl });
          es.close();
        } else if (job.status === "error") {
          setState({ phase: "error", error: job.error ?? "render_failed" });
          es.close();
        } else {
          setState({ phase: "running", renderId, progress: job.progress, status: job.status });
        }
      };
      es.onerror = () => {
        setState({ phase: "error", error: "stream_lost" });
        es.close();
      };
    }, [projectId]);
    return { state, start, reset: () => setState({ phase: "idle" }) };
  }
  ```
- [ ] **Step 2:** Commit: `feat(editor): useRender hook`.

---

### Task 8: Topbar Render button + RenderModal

**Files:**
- Modify: `apps/web/src/editor/components/Topbar.tsx`
- Create: `apps/web/src/editor/components/RenderModal.tsx`

- [ ] **Step 1:** Replace the placeholder "Render" button with one that opens `RenderModal`.
- [ ] **Step 2:** `RenderModal.tsx`:
  - Uses shadcn `Dialog`.
  - Body switches on `state.phase`:
    - `idle`: "Render this project to MP4?" + Start button.
    - `starting`/`running`: spinner + progress bar with `state.progress * 100`%, status label ("Bundling…" / "Rendering…").
    - `done`: download button linking to `state.outputUrl` + "Render again" button.
    - `error`: error message + Retry button.
- [ ] **Step 3:** Manual smoke (full pipeline): create a tiny project (1 scene, 1 layer, no audio) → click Render → progress increments → "Done" → click download → MP4 plays in VLC.
- [ ] **Step 4:** Commit: `feat(editor): render UI`.

---

### Task 9: Register a "Project" composition in runtime Root

**Files:**
- Modify: `packages/runtime/src/Root.tsx`

- [ ] **Step 1:** Add a registered composition specifically for renders (uses placeholder `defaultProps` but `inputProps` from the API at render time will override them):
  ```tsx
  // ADD before existing fixture registrations:
  <Composition
    id="Project"
    component={OpenEffectsComposition}
    durationInFrames={1}            // overridden by selectComposition
    fps={30}                        // overridden
    width={1920} height={1080}      // overridden
    defaultProps={{ project: { id: "", name: "", width: 1920, height: 1080, fps: 30 as 30, scenes: [] } }}
    calculateMetadata={async ({ props }) => {
      const total = props.project.scenes.reduce((acc: number, s: any) => acc + s.durationFrames, 0);
      return {
        durationInFrames: Math.max(1, total),
        fps: props.project.fps,
        width: props.project.width,
        height: props.project.height
      };
    }}
  />
  ```
- [ ] **Step 2:** Verify Studio still works for the fixtures (no regression).
- [ ] **Step 3:** Commit: `feat(runtime): "Project" composition for render`.

**Note:** `calculateMetadata` lets `selectComposition` derive width/height/fps/duration from the actual `inputProps`, so the renderer always uses the project's settings.

---

### Task 10: Make audio file URLs work in `<Audio>` from a bundle

- [ ] **Step 1:** Verify in T8 manual smoke that an audio track with a `file://...` `assetPath` plays in the rendered MP4. If `<Audio>` rejects `file://` from the headless browser context, fall back to one of:
  - **Option A**: serve audio from the bundle by symlinking `apps/web/public/assets/` into the bundle's static dir (Remotion bundle exposes a static folder).
  - **Option B**: pass an HTTP URL pointing at the dev server (`http://localhost:3000/assets/...`) — works only if the dev server is up. Acceptable in dev; brittle for headless.
  - **Option C** (cleanest): use `staticFile()` from Remotion if you place assets under `packages/runtime/public/`. Don't restructure: instead, keep `file://` and verify it works (it does in Remotion 4 for headless renders).
- [ ] **Step 2:** Document the chosen approach in `docs/decisions/08-render-asset-urls.md`.
- [ ] **Step 3:** Commit: `docs(decisions): render asset URL strategy`.

---

### Task 11: Stage closure verification

- [ ] **Step 1:** `npm test --workspaces --if-present` → all green.
- [ ] **Step 2:** Manual end-to-end:
  1. Create project 1280×720 30fps (smaller to save time).
  2. Add 2 scenes (60 frames each).
  3. Scene 1: layer with opacity 0→1 spring + translateX 0→500 ease-out.
  4. Scene 2: layer with bg-color red→blue linear, plus an audio track with fade-in volume keyframes and EQ presence +6 dB.
  5. Click Render → progress 0%→100% → Done.
  6. Download MP4 → play in VLC: visuals correct, audio with fade audible, EQ tonal change audible.
- [ ] **Step 3:** Verify subsequent render reuses bundle (much faster startup; "Bundling…" phase brief).
- [ ] **Step 4:** Verify error path: rename an asset on disk to break the path → render → see "error" state with message.
- [ ] **Step 5:** Tag closure: `git commit -m "STAGE-8: closed"`.

---

## Test summary

| Test | Type | File |
|---|---|---|
| `buildRenderProject` (mocked processEq) | integration | `tests/lib/render/buildRenderProject.test.ts` |
| `assetResolver` (3 cases) | unit | `tests/lib/render/assetResolver.test.ts` |
| `renderRegistry` create/get/update/subscribe | unit | `tests/lib/render/renderRegistry.test.ts` |
| End-to-end render of demo | manual | VLC playback |
| Bundle reuse across renders | manual | observe phase timing |
| Error surface from broken asset | manual | UI state |

---

## Risks specific to Stage 8

| Risk | Mitigation |
|---|---|
| `@remotion/bundler` first call is slow (10-30s) | Cached per process (T3). User sees "Bundling…" once per server boot. |
| Chrome / Headless dependency for renderer | Remotion auto-installs Chromium on first run. Documented in README. |
| Long renders block the Node process / API responsiveness | Render runs in async background; the API returns 202 immediately. SSE stream is independent. Acceptable for v1 single user. |
| In-memory registry loses jobs on server restart | UI's `useRender` will see SSE drop → error state. Acceptable; user re-clicks Render. |
| `file://` URLs in `<Audio src>` may not work in Remotion's headless render | T10 verifies and documents fallback. Most likely path: Remotion 4 supports `file://` in renderMedia. |
| Output path collisions if rendered twice in same millisecond | `timestampedFilename()` includes ms; collisions are practically impossible. If needed, append random suffix. |
| Disk fill from many renders | Out of scope for v1. Future: list + delete renders UI; auto-prune by age. |
| Concurrent render requests for same project | Allowed; each gets a separate `renderId` and writes a separate output file. The bundle is shared (cached). |
| User triggers render while editing — projectJson may have unsaved changes | Autosave debounces 1s; the modal could call `flushAutosave()` before posting. v1: rely on the user pressing render after a brief pause. Stage 9 polish: explicit "Save & render" button. |
| `@remotion/renderer` produces large MP4s | Acceptable. Codec = h264 default; future: expose codec/quality choice. |

---

## Handoff to Stage 9

Stage 9 (Polish) will:
- Add scene transitions (fade/slide/none) — these affect both `<Player>` preview and the rendered MP4 (because both consume the same `OpenEffectsComposition`).
- Add undo/redo, validations, loading states.
- Optionally surface a "Renders" page listing past outputs (out of scope for v1 unless Stage 9 captures it).

Stage 8 contracts that Stage 9 must respect:
- The `Project` composition uses `calculateMetadata` to derive width/height/fps/duration. Stage 9's transitions add overlap behavior — total duration formula must update accordingly.
- The render registry is process-local. If Stage 9 adds a "renders list" in the UI, it should read from disk (`ls public/renders/<projectId>/`), not from the registry.

---

## Final task checklist (execution order)

- [x] T1 — `buildRenderProject` (TDD) + add `assetSha256` to AudioTrack
- [x] T2 — Asset resolver (TDD)
- [x] T3 — Bundle cache
- [x] T4 — Render registry + render job + outputPath
- [x] T5 — `POST /api/render/:projectId`
- [x] T6 — SSE events endpoint
- [x] T7 — `useRender` client hook
- [x] T8 — Topbar Render button + RenderModal
- [x] T9 — Register "Project" composition with calculateMetadata
- [x] T10 — Asset URL strategy decision
- [x] T11 — Stage closure smoke

**Total tasks:** 11 · **Estimate:** 1.5 weeks · **Critical risks:** asset URL handling in headless render (T10 verifies upfront), bundle cold-start (one-time cost, well documented).
