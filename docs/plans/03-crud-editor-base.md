# Stage 3 — CRUD + Editor base (no animation) Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read `00-master-plan.md`, `01-foundation-stack.md`, and `02-runtime-engine.md` first. Stage 3 consumes the runtime engine built in Stage 2 — do NOT modify `packages/runtime/*` here. Animation arrives in Stage 4.

**Goal:** Make the editor usable for static composition end-to-end. User creates a project, opens it, adds/removes/reorders scenes and layers, edits HTML and CSS in Monaco, sees the change live in `<Player>`, autosaves to MariaDB, reloads the page, and finds everything intact.

**Architecture:** REST endpoints under `/api/projects` perform DB operations using a hydrate/persist pair (`toProjectJson(db)` ↔ `persistProjectJson(db, json)`) so the wire format matches `@open-effects/shared-types::Project` exactly. The editor page is a Next.js Server Component that fetches the initial project and hands it to a Client `<Editor>` which hydrates a Zustand store. All UI changes mutate the store; autosave debounces 1s and sends `PATCH /api/projects/:id` with the full `Project` JSON. `<Player>` reads `inputProps={{ project }}` from the store.

**Tech Stack:** Next.js Server + Client Components · Zustand 4 + Immer · `@remotion/player` · `@monaco-editor/react` (loaded with `ssr: false`) · `@dnd-kit/core` + `@dnd-kit/sortable` · shadcn/ui `dialog`, `input`, `tabs`, `select`, `slider`, `tooltip` · Vitest (unit + integration) · zod (request validation, schema reused from `shared-types`).

---

## Acceptance criteria → tasks map (Stage 3 master ACs)

| Master AC | Tasks |
|---|---|
| 1. REST `POST/GET/PATCH/DELETE /api/projects[/:id]` | T1, T2, T3, T4, T5 |
| 2. Editor `/projects/:id` with 3-panel layout | T11, T15 |
| 3. Scenes add/delete/drag-reorder/duration | T8, T13, T16 |
| 4. Layers add/delete/drag-reorder/select | T8, T13, T16 |
| 5. Inspector HTML and CSS via Monaco | T17, T18 |
| 6. `<Player>` + scrubber + play/pause | T14 |
| 7. Zustand store + autosave debounced | T7, T8, T19 |
| 8. Reload restores state | T20, T21 |

---

## File structure to create

```
apps/web/
├── package.json                              # add deps (T6)
├── src/
│   ├── lib/
│   │   ├── persistence/
│   │   │   ├── toProjectJson.ts              # DB → Project JSON
│   │   │   ├── persistProjectJson.ts         # Project JSON → DB (transactional)
│   │   │   └── index.ts
│   │   └── ids.ts                            # cuid helper for new entities
│   ├── editor/
│   │   ├── store.ts                          # Zustand store (with Immer)
│   │   ├── store.types.ts                    # State + Action types
│   │   ├── selectors.ts                      # derived selectors
│   │   ├── useAutosave.ts                    # debounced PATCH hook
│   │   ├── components/
│   │   │   ├── Editor.tsx                    # client root
│   │   │   ├── Topbar.tsx                    # project name, play, save status
│   │   │   ├── PreviewPane.tsx               # <Player>
│   │   │   ├── ScenesPanel.tsx               # left scenes list (DnD)
│   │   │   ├── LayersPanel.tsx               # left layers list (DnD)
│   │   │   ├── Sidebar.tsx                   # holds Scenes + Layers tabs
│   │   │   ├── Inspector.tsx                 # right panel with tabs
│   │   │   ├── inspector/
│   │   │   │   ├── PropsTab.tsx
│   │   │   │   ├── HtmlTab.tsx               # Monaco (html)
│   │   │   │   └── CssTab.tsx                # Monaco (css)
│   │   │   ├── Timeline.tsx                  # bottom timeline (read-only Stage 3)
│   │   │   └── MonacoLazy.tsx                # dynamic-imported Monaco wrapper
│   │   └── defaults.ts                       # default scene / layer factories
│   ├── app/
│   │   ├── api/projects/
│   │   │   ├── route.ts                      # GET (list, exists from Stage 1) + POST (create)
│   │   │   └── [id]/
│   │   │       └── route.ts                  # GET / PATCH / DELETE
│   │   ├── projects/
│   │   │   ├── page.tsx                      # MODIFY: enable "+ New project"
│   │   │   ├── _components/
│   │   │   │   └── NewProjectDialog.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx                  # editor entry (Server Component)
│   │   └── layout.tsx                        # may add toaster
│   └── components/ui/                        # add: dialog, input, label, select, tabs, slider, tooltip, sonner (toasts)
└── tests/
    ├── persistence/
    │   ├── toProjectJson.test.ts
    │   └── persistProjectJson.test.ts
    ├── api/
    │   └── projects.crud.test.ts
    └── editor/
        ├── store.test.ts
        └── selectors.test.ts
```

---

## Task list (execution order)

### Task 1: Install editor deps + add shadcn primitives

**Files:**
- Modify: `apps/web/package.json`
- Create (via shadcn or manual copy): `components/ui/dialog.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `tabs.tsx`, `slider.tsx`, `tooltip.tsx`, `sonner.tsx`

- [ ] **Step 1:** `npm install zustand@4 immer @remotion/player@4 @monaco-editor/react monaco-editor @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities sonner zod@3 -w apps/web`
- [ ] **Step 2:** `npm install @open-effects/runtime@* @open-effects/shared-types@* -w apps/web` (resolves to local workspace packages).
- [ ] **Step 3:** Add the listed shadcn primitives (manual copy from https://ui.shadcn.com — same approach as Stage 1 T6).
- [ ] **Step 4:** Verify imports compile: `npm run typecheck -w apps/web`.
- [ ] **Step 5:** Commit: `chore(web): editor deps + shadcn primitives`.

---

### Task 2: ID helper + default factories

**Files:**
- Create: `apps/web/src/lib/ids.ts`, `apps/web/src/editor/defaults.ts`

- [ ] **Step 1:** Implement `ids.ts` with a small cuid wrapper:
  ```ts
  import { createId } from "@paralleldrive/cuid2"; // npm install @paralleldrive/cuid2 -w apps/web
  export const newId = (prefix = "") => `${prefix}${createId()}`;
  ```
  (Adds a single dep. Alternative: import `cuid` from Prisma's runtime — but it's not exposed publicly. Cuid2 is fine.)
- [ ] **Step 2:** `npm install @paralleldrive/cuid2 -w apps/web`.
- [ ] **Step 3:** Implement `defaults.ts`:
  ```ts
  import { newId } from "@/lib/ids";
  import type { Scene, Layer } from "@open-effects/shared-types";
  export const defaultLayer = (order: number, endFrame: number): Layer => ({
    id: newId(), order, name: `Layer ${order + 1}`,
    html: '<div class="content">New layer</div>',
    css: '.content { color: white; font-size: 48px; padding: 40px; font-family: sans-serif; }',
    startFrame: 0, endFrame, keyframes: []
  });
  export const defaultScene = (order: number, durationFrames = 90): Scene => ({
    id: newId(), order, durationFrames,
    transitionIn: null,
    layers: [defaultLayer(0, durationFrames)],
    audioTracks: []
  });
  ```
- [ ] **Step 4:** Commit: `feat(web): id helper + default factories`.

---

### Task 3: `toProjectJson` (DB → JSON) (TDD)

**Files:**
- Create: `apps/web/src/lib/persistence/toProjectJson.ts`, `apps/web/tests/persistence/toProjectJson.test.ts`

- [ ] **Step 1:** Write failing test that seeds a project with 1 scene + 1 layer + 0 keyframes via Prisma, calls `toProjectJson(projectId)`, asserts the result conforms to `ProjectSchema.parse(...)` AND has the expected ids/values.
- [ ] **Step 2:** Implement:
  ```ts
  import { db } from "@/lib/db";
  import { ProjectSchema, type Project } from "@open-effects/shared-types";
  export async function toProjectJson(projectId: string): Promise<Project> {
    const p = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        scenes: {
          orderBy: { order: "asc" },
          include: {
            layers: {
              orderBy: { order: "asc" },
              include: { keyframes: { orderBy: [{ property: "asc" }, { frame: "asc" }] } }
            },
            audioTracks: {
              include: {
                asset: true,
                volumeKeyframes: { orderBy: { frame: "asc" } }
              }
            }
          }
        }
      }
    });
    const project: Project = {
      id: p.id, name: p.name, width: p.width, height: p.height,
      fps: p.fps as 24 | 30 | 60,
      scenes: p.scenes.map((s) => ({
        id: s.id, order: s.order, durationFrames: s.durationFrames,
        transitionIn: s.transitionIn as Project["scenes"][number]["transitionIn"] ?? null,
        layers: s.layers.map((l) => ({
          id: l.id, order: l.order, name: l.name, html: l.html, css: l.css,
          startFrame: l.startFrame, endFrame: l.endFrame,
          keyframes: l.keyframes.map((k) => ({
            id: k.id, frame: k.frame, property: k.property, value: k.value,
            easingOut: k.easingOut as any
          }))
        })),
        audioTracks: s.audioTracks.map((t) => ({
          id: t.id, assetId: t.assetId, assetPath: t.asset.path,
          startFrame: t.startFrame, trimStart: t.trimStart, trimEnd: t.trimEnd,
          eq: t.eq as any ?? null,
          volumeKeyframes: t.volumeKeyframes.map((k) => ({
            id: k.id, frame: k.frame, value: k.value, easingOut: k.easingOut as any
          }))
        }))
      }))
    };
    return ProjectSchema.parse(project);
  }
  ```
- [ ] **Step 3:** Test passes.
- [ ] **Step 4:** Commit: `feat(persistence): toProjectJson`.

**Test isolation:** wrap each test in a transaction or use `beforeEach(() => db.project.deleteMany())`. Cuid IDs prevent collisions.

---

### Task 4: `persistProjectJson` (JSON → DB) (TDD)

**Files:**
- Create: `apps/web/src/lib/persistence/persistProjectJson.ts`, `apps/web/tests/persistence/persistProjectJson.test.ts`

- [ ] **Step 1:** Write failing tests:
  - Persists a project with 2 scenes × 2 layers each → DB has matching rows.
  - Updating an existing project replaces scenes/layers/keyframes correctly (delete + insert in one transaction).
  - Round-trip: `persist → toProjectJson` returns equivalent JSON.
- [ ] **Step 2:** Implement:
  ```ts
  import { db } from "@/lib/db";
  import { ProjectSchema, type Project } from "@open-effects/shared-types";

  export async function persistProjectJson(projectId: string, project: Project) {
    const validated = ProjectSchema.parse(project);
    return db.$transaction(async (tx) => {
      // Update root fields
      await tx.project.update({
        where: { id: projectId },
        data: { name: validated.name, width: validated.width, height: validated.height, fps: validated.fps }
      });
      // Replace strategy: delete all scenes (cascades to layers/keyframes/audioTracks/volumeKeyframes)
      // and re-insert. Acceptable for v1 with autosave debounced — runs on a single user.
      await tx.scene.deleteMany({ where: { projectId } });
      for (const scene of validated.scenes) {
        await tx.scene.create({
          data: {
            id: scene.id, projectId, order: scene.order,
            durationFrames: scene.durationFrames,
            transitionIn: scene.transitionIn ?? undefined,
            layers: {
              create: scene.layers.map((l) => ({
                id: l.id, order: l.order, name: l.name, html: l.html, css: l.css,
                startFrame: l.startFrame, endFrame: l.endFrame,
                keyframes: { create: l.keyframes.map((k) => ({
                  id: k.id, frame: k.frame, property: k.property,
                  value: k.value, easingOut: k.easingOut
                })) }
              }))
            },
            audioTracks: {
              create: scene.audioTracks.map((t) => ({
                id: t.id, assetId: t.assetId,
                startFrame: t.startFrame, trimStart: t.trimStart, trimEnd: t.trimEnd,
                eq: t.eq ?? undefined,
                volumeKeyframes: { create: t.volumeKeyframes.map((k) => ({
                  id: k.id, frame: k.frame, value: k.value, easingOut: k.easingOut
                })) }
              }))
            }
          }
        });
      }
    }, { timeout: 15000 });
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(persistence): persistProjectJson (transactional replace)`.

**Trade-off documented:** delete + re-insert keeps the implementation simple at autosave cadence (1s debounce, single user). If multi-user comes later, switch to upsert/diff strategy. For v1, this is YAGNI-correct.

---

### Task 5: `POST /api/projects` (TDD)

**Files:**
- Modify: `apps/web/src/app/api/projects/route.ts`
- Create: `apps/web/tests/api/projects.crud.test.ts`

- [ ] **Step 1:** Write failing tests:
  - POST with valid body `{ name, width, height, fps }` returns 201 + new project JSON.
  - POST with missing `name` returns 400.
  - POST with `fps: 50` returns 400.
- [ ] **Step 2:** Modify `route.ts` to add POST:
  ```ts
  import { NextResponse } from "next/server";
  import { z } from "zod";
  import { db } from "@/lib/db";
  import { defaultScene } from "@/editor/defaults";
  import { persistProjectJson } from "@/lib/persistence/persistProjectJson";

  const CreateBody = z.object({
    name: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)])
  });

  export async function POST(req: Request) {
    const parsed = CreateBody.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { name, width, height, fps } = parsed.data;
    const project = await db.project.create({ data: { name, width, height, fps } });
    // seed with one default scene
    await persistProjectJson(project.id, {
      id: project.id, name, width, height, fps,
      scenes: [defaultScene(0)]
    });
    return NextResponse.json({ id: project.id }, { status: 201 });
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(api): POST /api/projects`.

---

### Task 6: `GET / PATCH / DELETE /api/projects/:id` (TDD)

**Files:**
- Create: `apps/web/src/app/api/projects/[id]/route.ts`
- Modify: `apps/web/tests/api/projects.crud.test.ts`

- [ ] **Step 1:** Add failing tests:
  - GET returns the project as `Project` JSON; 404 if not found.
  - PATCH with a valid `Project` body persists and returns 200.
  - PATCH with invalid body returns 400.
  - DELETE removes the project; subsequent GET returns 404.
- [ ] **Step 2:** Implement `route.ts`:
  ```ts
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  import { toProjectJson } from "@/lib/persistence/toProjectJson";
  import { persistProjectJson } from "@/lib/persistence/persistProjectJson";
  import { ProjectSchema } from "@open-effects/shared-types";

  type Ctx = { params: Promise<{ id: string }> };

  export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params;
    try { return NextResponse.json(await toProjectJson(id)); }
    catch { return NextResponse.json({ error: "not_found" }, { status: 404 }); }
  }

  export async function PATCH(req: Request, { params }: Ctx) {
    const { id } = await params;
    const body = await req.json();
    const parsed = ProjectSchema.safeParse({ ...body, id });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await persistProjectJson(id, parsed.data);
    return NextResponse.json({ ok: true });
  }

  export async function DELETE(_req: Request, { params }: Ctx) {
    const { id } = await params;
    await db.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(api): GET/PATCH/DELETE /api/projects/[id]`.

---

### Task 7: Zustand store types + skeleton (TDD)

**Files:**
- Create: `apps/web/src/editor/store.types.ts`, `apps/web/src/editor/store.ts`, `apps/web/tests/editor/store.test.ts`

- [ ] **Step 1:** Define types in `store.types.ts`:
  ```ts
  import type { Project, Scene, Layer } from "@open-effects/shared-types";
  export type SaveStatus = "idle" | "saving" | "saved" | "error";
  export interface EditorState {
    project: Project;
    selectedSceneId: string | null;
    selectedLayerId: string | null;
    currentFrame: number;
    isPlaying: boolean;
    saveStatus: SaveStatus;
    lastSavedAt: number | null;
  }
  export interface EditorActions {
    setProject: (p: Project) => void;
    selectScene: (id: string | null) => void;
    selectLayer: (id: string | null) => void;
    setCurrentFrame: (f: number) => void;
    play: () => void;
    pause: () => void;
    addScene: () => void;
    deleteScene: (sceneId: string) => void;
    reorderScenes: (orderedIds: string[]) => void;
    setSceneDuration: (sceneId: string, durationFrames: number) => void;
    addLayer: (sceneId: string) => void;
    deleteLayer: (layerId: string) => void;
    reorderLayers: (sceneId: string, orderedIds: string[]) => void;
    updateLayerHtml: (layerId: string, html: string) => void;
    updateLayerCss: (layerId: string, css: string) => void;
    updateLayerName: (layerId: string, name: string) => void;
    updateLayerFrames: (layerId: string, startFrame: number, endFrame: number) => void;
    setSaveStatus: (s: SaveStatus) => void;
    markSaved: () => void;
  }
  ```
- [ ] **Step 2:** Write failing tests for at least these reducers (no React, pure store):
  - `addScene` increments scene count, sets `order` to last+1, with default duration 90.
  - `deleteScene` removes the scene and clears selection if it was selected.
  - `reorderScenes` updates `order` in place to match the new array order.
  - `addLayer` appends a layer with `order = layers.length`, default frames 0..sceneDuration.
  - `deleteLayer` removes the layer and clears selection if it was selected.
  - `reorderLayers` updates layer `order`.
  - `updateLayerHtml` mutates the right layer.
  - `setSceneDuration` updates scene duration AND clamps any layer's `endFrame` to new duration.
- [ ] **Step 3:** Implement `store.ts` with Zustand + Immer (`zustand/middleware/immer` if available; otherwise use Immer's `produce` inside set):
  ```ts
  import { create } from "zustand";
  import { immer } from "zustand/middleware/immer";
  import type { EditorState, EditorActions } from "./store.types";
  import { defaultScene, defaultLayer } from "./defaults";

  export const useEditorStore = create<EditorState & EditorActions>()(
    immer((set, get) => ({
      project: { id: "", name: "", width: 1920, height: 1080, fps: 30, scenes: [] },
      selectedSceneId: null,
      selectedLayerId: null,
      currentFrame: 0,
      isPlaying: false,
      saveStatus: "idle",
      lastSavedAt: null,
      setProject: (p) => set((s) => { s.project = p; s.selectedSceneId = p.scenes[0]?.id ?? null; }),
      selectScene: (id) => set((s) => { s.selectedSceneId = id; s.selectedLayerId = null; }),
      selectLayer: (id) => set((s) => { s.selectedLayerId = id; }),
      setCurrentFrame: (f) => set((s) => { s.currentFrame = f; }),
      play: () => set((s) => { s.isPlaying = true; }),
      pause: () => set((s) => { s.isPlaying = false; }),
      addScene: () => set((s) => {
        s.project.scenes.push(defaultScene(s.project.scenes.length));
      }),
      deleteScene: (sceneId) => set((s) => {
        s.project.scenes = s.project.scenes.filter((sc) => sc.id !== sceneId).map((sc, i) => ({ ...sc, order: i }));
        if (s.selectedSceneId === sceneId) s.selectedSceneId = s.project.scenes[0]?.id ?? null;
      }),
      reorderScenes: (orderedIds) => set((s) => {
        const map = new Map(s.project.scenes.map((sc) => [sc.id, sc]));
        s.project.scenes = orderedIds.map((id, i) => ({ ...map.get(id)!, order: i }));
      }),
      setSceneDuration: (sceneId, durationFrames) => set((s) => {
        const sc = s.project.scenes.find((x) => x.id === sceneId);
        if (!sc) return;
        sc.durationFrames = durationFrames;
        sc.layers.forEach((l) => { if (l.endFrame > durationFrames) l.endFrame = durationFrames; });
      }),
      addLayer: (sceneId) => set((s) => {
        const sc = s.project.scenes.find((x) => x.id === sceneId);
        if (!sc) return;
        sc.layers.push(defaultLayer(sc.layers.length, sc.durationFrames));
      }),
      deleteLayer: (layerId) => set((s) => {
        for (const sc of s.project.scenes) {
          const before = sc.layers.length;
          sc.layers = sc.layers.filter((l) => l.id !== layerId).map((l, i) => ({ ...l, order: i }));
          if (sc.layers.length !== before && s.selectedLayerId === layerId) s.selectedLayerId = null;
        }
      }),
      reorderLayers: (sceneId, orderedIds) => set((s) => {
        const sc = s.project.scenes.find((x) => x.id === sceneId);
        if (!sc) return;
        const map = new Map(sc.layers.map((l) => [l.id, l]));
        sc.layers = orderedIds.map((id, i) => ({ ...map.get(id)!, order: i }));
      }),
      updateLayerHtml: (layerId, html) => set((s) => mutateLayer(s, layerId, (l) => { l.html = html; })),
      updateLayerCss: (layerId, css) => set((s) => mutateLayer(s, layerId, (l) => { l.css = css; })),
      updateLayerName: (layerId, name) => set((s) => mutateLayer(s, layerId, (l) => { l.name = name; })),
      updateLayerFrames: (layerId, startFrame, endFrame) => set((s) => mutateLayer(s, layerId, (l) => {
        l.startFrame = startFrame; l.endFrame = endFrame;
      })),
      setSaveStatus: (status) => set((s) => { s.saveStatus = status; }),
      markSaved: () => set((s) => { s.saveStatus = "saved"; s.lastSavedAt = Date.now(); })
    }))
  );

  function mutateLayer(state: any, layerId: string, mut: (l: any) => void) {
    for (const sc of state.project.scenes) {
      const l = sc.layers.find((x: any) => x.id === layerId);
      if (l) { mut(l); return; }
    }
  }
  ```
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit: `feat(editor): zustand store + reducers`.

---

### Task 8: Selectors (small TDD)

**Files:**
- Create: `apps/web/src/editor/selectors.ts`, `apps/web/tests/editor/selectors.test.ts`

- [ ] **Step 1:** Write failing tests for selectors:
  - `selectActiveScene(state)` returns the scene matching `selectedSceneId` or null.
  - `selectActiveLayer(state)` returns the layer matching `selectedLayerId` or null.
  - `selectTotalDuration(state)` returns sum of scene durations.
- [ ] **Step 2:** Implement:
  ```ts
  import type { EditorState } from "./store.types";
  export const selectActiveScene = (s: EditorState) =>
    s.project.scenes.find((sc) => sc.id === s.selectedSceneId) ?? null;
  export const selectActiveLayer = (s: EditorState) => {
    for (const sc of s.project.scenes) {
      const l = sc.layers.find((x) => x.id === s.selectedLayerId);
      if (l) return l;
    }
    return null;
  };
  export const selectTotalDuration = (s: EditorState) =>
    s.project.scenes.reduce((acc, sc) => acc + sc.durationFrames, 0);
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(editor): selectors`.

---

### Task 9: `useAutosave` hook (debounced PATCH)

**Files:**
- Create: `apps/web/src/editor/useAutosave.ts`

- [ ] **Step 1:** Implement (no automated test — covered by Stage 3 closure manual reload test):
  ```ts
  import { useEffect, useRef } from "react";
  import { useEditorStore } from "./store";

  export function useAutosave() {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
      const unsub = useEditorStore.subscribe((state, prev) => {
        if (state.project === prev.project) return;
        if (timer.current) clearTimeout(timer.current);
        useEditorStore.getState().setSaveStatus("idle");
        timer.current = setTimeout(async () => {
          const { project, setSaveStatus, markSaved } = useEditorStore.getState();
          if (!project.id) return;
          setSaveStatus("saving");
          try {
            const res = await fetch(`/api/projects/${project.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(project)
            });
            if (!res.ok) throw new Error(await res.text());
            markSaved();
          } catch (e) {
            console.error("autosave failed", e);
            setSaveStatus("error");
          }
        }, 1000);
      });
      return () => { unsub(); if (timer.current) clearTimeout(timer.current); };
    }, []);
  }
  ```
  Note: requires Zustand `subscribe` middleware. Ensure `subscribeWithSelector` is set on the store if needed; otherwise the default `subscribe` works for full-state updates.
- [ ] **Step 2:** Commit: `feat(editor): useAutosave hook`.

**Note on store mutations:** because we use Immer, `state.project` is a NEW reference whenever any nested mutation happens, so `state.project === prev.project` correctly distinguishes project changes from non-project state changes (selection, currentFrame, isPlaying).

---

### Task 10: Lazy Monaco wrapper

**Files:**
- Create: `apps/web/src/editor/components/MonacoLazy.tsx`

- [ ] **Step 1:** Implement:
  ```tsx
  "use client";
  import dynamic from "next/dynamic";
  export const MonacoLazy = dynamic(
    () => import("@monaco-editor/react").then((m) => m.default),
    { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading editor…</div> }
  );
  ```
- [ ] **Step 2:** Commit: `feat(editor): lazy Monaco wrapper`.

---

### Task 11: 3-panel layout shell + Editor root

**Files:**
- Create: `apps/web/src/editor/components/Editor.tsx`, `Topbar.tsx`, `Sidebar.tsx`, `Inspector.tsx`, `PreviewPane.tsx`, `Timeline.tsx` (skeletons)
- Create: `apps/web/src/app/projects/[id]/page.tsx`

- [ ] **Step 1:** Write `app/projects/[id]/page.tsx` (Server Component):
  ```tsx
  import { notFound } from "next/navigation";
  import { toProjectJson } from "@/lib/persistence/toProjectJson";
  import { Editor } from "@/editor/components/Editor";

  export const dynamic = "force-dynamic";

  export default async function ProjectEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
      const project = await toProjectJson(id);
      return <Editor initialProject={project} />;
    } catch { notFound(); }
  }
  ```
- [ ] **Step 2:** Implement `Editor.tsx` as the Client root:
  ```tsx
  "use client";
  import { useEffect } from "react";
  import { useEditorStore } from "@/editor/store";
  import { useAutosave } from "@/editor/useAutosave";
  import type { Project } from "@open-effects/shared-types";
  import { Topbar } from "./Topbar";
  import { Sidebar } from "./Sidebar";
  import { PreviewPane } from "./PreviewPane";
  import { Inspector } from "./Inspector";
  import { Timeline } from "./Timeline";

  export function Editor({ initialProject }: { initialProject: Project }) {
    const setProject = useEditorStore((s) => s.setProject);
    useEffect(() => { setProject(initialProject); }, [initialProject, setProject]);
    useAutosave();
    return (
      <div className="grid h-screen grid-rows-[auto_1fr_300px]">
        <Topbar />
        <div className="grid grid-cols-[260px_1fr_340px] overflow-hidden">
          <Sidebar />
          <PreviewPane />
          <Inspector />
        </div>
        <Timeline />
      </div>
    );
  }
  ```
- [ ] **Step 3:** Stub `Topbar`, `Sidebar`, `PreviewPane`, `Inspector`, `Timeline` as `<div>` placeholders for now.
- [ ] **Step 4:** Visual check: navigate to `/projects/<id>` (after Task 12 lets you create one). Initially: 404 — fine for now, will resolve in next tasks.
- [ ] **Step 5:** Commit: `feat(editor): 3-panel layout shell + Editor root`.

---

### Task 12: NewProjectDialog + enable creation on `/projects`

**Files:**
- Create: `apps/web/src/app/projects/_components/NewProjectDialog.tsx`
- Modify: `apps/web/src/app/projects/page.tsx`

- [ ] **Step 1:** Implement `NewProjectDialog.tsx` with shadcn `Dialog`, fields name/width/height/fps. On submit: `POST /api/projects`, navigate to `/projects/<newId>`.
- [ ] **Step 2:** Modify `/projects/page.tsx` to render the dialog trigger as the `+ New project` button (replace the disabled placeholder from Stage 1).
- [ ] **Step 3:** Manual: from the projects page, create a new project named "Test", 1920×1080, fps 30 → redirected to `/projects/<id>` (will show the empty Editor shell from Task 11).
- [ ] **Step 4:** Commit: `feat(web): new project dialog`.

---

### Task 13: ScenesPanel + LayersPanel with DnD reorder

**Files:**
- Modify: `apps/web/src/editor/components/Sidebar.tsx`
- Create: `apps/web/src/editor/components/ScenesPanel.tsx`, `LayersPanel.tsx`

- [ ] **Step 1:** Implement `ScenesPanel.tsx` using `@dnd-kit/sortable`. Each scene shows order + name (`Scene N`) + duration; click selects, "+" adds (calls `addScene`), "×" deletes (with confirm). Drag updates `reorderScenes`.
- [ ] **Step 2:** Implement `LayersPanel.tsx` similarly. Reads `selectActiveScene(state).layers`. Click selects a layer, "+" adds, "×" deletes, drag updates `reorderLayers`.
- [ ] **Step 3:** `Sidebar.tsx` shows both stacked or in tabs (recommendation: shadcn `Tabs` "Scenes" / "Layers").
- [ ] **Step 4:** Manual: add 3 scenes, drag-reorder, add 2 layers per scene, drag-reorder layers. Selection updates highlight.
- [ ] **Step 5:** Commit: `feat(editor): scenes + layers panels with DnD`.

---

### Task 14: PreviewPane with `<Player>`

**Files:**
- Modify: `apps/web/src/editor/components/PreviewPane.tsx`

- [ ] **Step 1:** Implement:
  ```tsx
  "use client";
  import dynamic from "next/dynamic";
  import { useEditorStore } from "@/editor/store";
  import { selectTotalDuration } from "@/editor/selectors";
  import { OpenEffectsComposition } from "@open-effects/runtime";

  const Player = dynamic(
    () => import("@remotion/player").then((m) => m.Player),
    { ssr: false }
  );

  export function PreviewPane() {
    const project = useEditorStore((s) => s.project);
    const totalFrames = useEditorStore(selectTotalDuration);
    if (!project.id) return null;
    return (
      <div className="flex items-center justify-center bg-black/90 p-4">
        <div className="aspect-video w-full max-w-3xl">
          <Player
            component={OpenEffectsComposition}
            inputProps={{ project }}
            durationInFrames={Math.max(totalFrames, 1)}
            compositionWidth={project.width}
            compositionHeight={project.height}
            fps={project.fps}
            controls
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    );
  }
  ```
- [ ] **Step 2:** Manual: open editor → see Player with default scene + layer rendering "New layer" text. Press Play → seeks through total duration.
- [ ] **Step 3:** Commit: `feat(editor): PreviewPane with @remotion/player`.

**Note:** `<Player>`'s built-in controls cover scrubber + play/pause for Stage 3. Stage 9 may add a custom scrubber tied to `currentFrame` in the store if needed for keyframe placement UX (Stage 4 will cover that).

---

### Task 15: Inspector tabs Props / HTML / CSS

**Files:**
- Modify: `apps/web/src/editor/components/Inspector.tsx`
- Create: `inspector/PropsTab.tsx`, `inspector/HtmlTab.tsx`, `inspector/CssTab.tsx`

- [ ] **Step 1:** Inspector reads `selectActiveLayer`. If null, show "Select a layer". Otherwise render shadcn `Tabs` with three triggers.
- [ ] **Step 2:** `PropsTab.tsx`: form inputs bound to `updateLayerName`, `updateLayerFrames` (start/end frames), shows layer order (read-only).
- [ ] **Step 3:** `HtmlTab.tsx`:
  ```tsx
  "use client";
  import { MonacoLazy } from "../MonacoLazy";
  import { useEditorStore } from "@/editor/store";
  import { selectActiveLayer } from "@/editor/selectors";
  export function HtmlTab() {
    const layer = useEditorStore(selectActiveLayer);
    const update = useEditorStore((s) => s.updateLayerHtml);
    if (!layer) return null;
    return (
      <MonacoLazy
        height="100%"
        defaultLanguage="html"
        value={layer.html}
        onChange={(v) => update(layer.id, v ?? "")}
        options={{ minimap: { enabled: false }, wordWrap: "on", fontSize: 13 }}
      />
    );
  }
  ```
- [ ] **Step 4:** `CssTab.tsx`: identical pattern, `defaultLanguage="css"`, `updateLayerCss`.
- [ ] **Step 5:** Manual: select a layer → edit HTML → preview updates within ~1s (Player re-renders on `inputProps` change). Edit CSS → same.
- [ ] **Step 6:** Commit: `feat(editor): inspector tabs (Props/HTML/CSS)`.

**Performance note:** Monaco is lazy-loaded; re-renders on each keystroke are acceptable for v1. Each keystroke triggers store update → debounced autosave (1s after last). Editor remounts can be heavy; mitigate by keying each tab by `layer.id` so switching layers fully reinitializes Monaco state.

---

### Task 16: Topbar (project name, save status, current frame)

**Files:**
- Modify: `apps/web/src/editor/components/Topbar.tsx`

- [ ] **Step 1:** Implement:
  - Project name (editable input bound to `updateProjectName` — small new action; add to store with TDD test) — or read-only for v1 (Stage 9 adds rename UX). Keep read-only here.
  - Save status indicator: "Saving…" / "Saved 12s ago" / "Save error" with retry.
  - "Render" button (disabled until Stage 8).
- [ ] **Step 2:** Commit: `feat(editor): Topbar with save status`.

---

### Task 17: Timeline (read-only strip for Stage 3)

**Files:**
- Modify: `apps/web/src/editor/components/Timeline.tsx`

- [ ] **Step 1:** Render scene segments as horizontal bars with width proportional to `durationFrames`. Selecting a segment highlights it (clicks call `selectScene`). No keyframe dots yet (Stage 4) and no audio strips (Stage 5).
- [ ] **Step 2:** Show `currentFrame` cursor as a vertical line scaled to total duration.
- [ ] **Step 3:** Subscribe to `<Player>` frame updates: register `playerRef` and call `setCurrentFrame` on `playerRef.current.getCurrentFrame()` via `requestAnimationFrame` while `isPlaying`. (Optional polish in this task; minimum viable: cursor moves with the Player's internal scrubber by listening to `playerRef.current.addEventListener("frameupdate", ...)`.)
- [ ] **Step 4:** Manual: scrub the Player → cursor in Timeline moves; click a scene segment → selection updates and Inspector reflects.
- [ ] **Step 5:** Commit: `feat(editor): basic timeline strip`.

---

### Task 18: DELETE handling on `/projects` list

**Files:**
- Modify: `apps/web/src/app/projects/page.tsx`

- [ ] **Step 1:** Render each project card with a delete button (shadcn confirm dialog). Calls `DELETE /api/projects/:id` then refreshes via `router.refresh()`.
- [ ] **Step 2:** Manual: delete the test project, confirm it disappears.
- [ ] **Step 3:** Commit: `feat(web): delete project from list`.

---

### Task 19: Toaster integration

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `useAutosave.ts` to fire toasts on error

- [ ] **Step 1:** Mount `<Toaster />` from `sonner` in root layout.
- [ ] **Step 2:** In `useAutosave`, call `toast.error("Autosave failed", { description: msg })` on failure, `toast.success("Saved", { duration: 1000 })` on success (optional / configurable).
- [ ] **Step 3:** Commit: `feat(web): toast notifications`.

---

### Task 20: Persistence smoke + reload test (manual + automated)

**Files:**
- Modify: `apps/web/tests/persistence/persistProjectJson.test.ts` (add round-trip tests if not already covered)

- [ ] **Step 1:** Automated test (already in T4) covers persist → toProjectJson round-trip identity for a complex fixture (2 scenes × 3 layers × HTML+CSS).
- [ ] **Step 2:** Manual smoke:
  1. Create a project.
  2. Add 3 scenes; reorder them.
  3. In scene 2, add 2 layers, edit HTML and CSS in both.
  4. Wait 2s (autosave window).
  5. Hard reload page (F5).
  6. Verify: scene order preserved, layers preserved, HTML/CSS preserved, selection cleared (acceptable).

---

### Task 21: Stage closure verification

- [ ] **Step 1:** `npm test --workspaces --if-present` → all green.
- [ ] **Step 2:** `npm run typecheck --workspaces --if-present` → clean.
- [ ] **Step 3:** Manual smoke (Task 20 step 2) passes.
- [ ] **Step 4:** Manual: navigate `/` → "Go to projects" → "+ New project" → editor opens → live preview shows default layer.
- [ ] **Step 5:** Tag closure: `git commit -m "STAGE-3: closed"`.

---

## Test summary

| Test | Type | File |
|---|---|---|
| `toProjectJson` round-trip | integration | `tests/persistence/toProjectJson.test.ts` |
| `persistProjectJson` insert + replace + round-trip | integration | `tests/persistence/persistProjectJson.test.ts` |
| `POST /api/projects` valid + 2 invalid | integration | `tests/api/projects.crud.test.ts` |
| `GET /api/projects/:id` ok + 404 | integration | `tests/api/projects.crud.test.ts` |
| `PATCH /api/projects/:id` ok + invalid | integration | `tests/api/projects.crud.test.ts` |
| `DELETE /api/projects/:id` | integration | `tests/api/projects.crud.test.ts` |
| Store reducers (≥8 cases) | unit | `tests/editor/store.test.ts` |
| Selectors (3 cases) | unit | `tests/editor/selectors.test.ts` |
| Editor smoke: create → edit → reload | manual | browser |

---

## Risks specific to Stage 3

| Risk | Mitigation |
|---|---|
| Monaco bundles huge → slow first paint | `dynamic({ ssr: false })` + skeleton loader (T10). Acceptable for internal tool. |
| `<Player>` SSR errors | Same `dynamic({ ssr: false })` pattern in PreviewPane (T14). |
| Autosave races (rapid edits while a save is in flight) | Single-flight pattern — if a PATCH is in-flight, do NOT cancel; queue at most one pending save. Implemented as a small flag in `useAutosave` if observed. For v1 single-user, the 1s debounce makes collisions rare. |
| `persistProjectJson` delete-then-insert is heavy on big projects | Acceptable for v1 (≤30 layers/scene, ≤10 scenes). If autosave latency becomes user-visible, switch to upsert-by-id strategy in a follow-up. |
| dnd-kit DragOverlay can lose item visual on Cancel | Standard pattern from dnd-kit docs; cover with manual test in T13. |
| Foreign key `Asset` required by `AudioTrack` (Stage 5) → in Stage 3 there are no AudioTracks, but `persistProjectJson` includes `assetId` in the create — ensure default scene has empty `audioTracks: []` | Default scene from `defaults.ts` already has `audioTracks: []`. Tested in T4 round-trip. |
| Editor first paint flickers when `setProject(initialProject)` runs in `useEffect` | The shell starts with empty project skeleton; the flash is brief. If perceived, hydrate via `useState(() => initialProject)` instead — note in T11 if observed in QA. |

---

## Handoff to Stage 4

Stage 4 (`04-keyframe-animation.md`) will:
- Add `Keyframe` panel to the Inspector (4th tab).
- Implement `computeStylesAtFrame` in `packages/runtime` (with whitelist of animatable properties + popmotion mix spike).
- Extend `Layer` to merge computed inline styles onto the wrapper.
- Add keyframe dots to the Timeline with drag-to-move-frame.
- Add `addKeyframe`, `deleteKeyframe`, `moveKeyframe`, `updateKeyframeValue`, `updateKeyframeEasing` actions to the store.
- Schema in `shared-types` already supports keyframes — no DB changes.
- Stage 3 contracts that Stage 4 must respect:
  - Store action API surface (`updateLayer*`, `selectLayer`).
  - Autosave debouncing already handles keyframe edits via `s.project` reference change.
  - PATCH endpoint already validates against `ProjectSchema` which includes keyframes.

---

## Final task checklist (execution order)

- [ ] T1 — Install deps + shadcn primitives
- [ ] T2 — IDs + default factories
- [ ] T3 — `toProjectJson` (TDD)
- [ ] T4 — `persistProjectJson` (TDD)
- [ ] T5 — `POST /api/projects` (TDD)
- [ ] T6 — `GET/PATCH/DELETE /api/projects/[id]` (TDD)
- [ ] T7 — Zustand store + reducers (TDD)
- [ ] T8 — Selectors (TDD)
- [ ] T9 — `useAutosave` hook
- [ ] T10 — Lazy Monaco wrapper
- [ ] T11 — 3-panel layout shell + Editor root + page route
- [ ] T12 — NewProjectDialog
- [ ] T13 — Scenes + Layers panels with DnD
- [ ] T14 — PreviewPane with `<Player>`
- [ ] T15 — Inspector tabs (Props/HTML/CSS)
- [ ] T16 — Topbar with save status
- [ ] T17 — Timeline (read-only strip)
- [ ] T18 — Delete from projects list
- [ ] T19 — Toaster
- [ ] T20 — Reload smoke test
- [ ] T21 — Stage closure

**Total tasks:** 21 · **Estimate:** 3 weeks · **Critical risks:** Monaco/Player SSR (mitigated by `dynamic`), autosave race (mitigated by debounce + single user), DnD edge cases (covered by manual tests in T13).
