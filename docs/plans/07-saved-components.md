# Stage 7 — Saved Components (snapshot) Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read all prior plans first. Stage 7 introduces reusability without coupling: snapshot-based saved components. **Snapshot semantics** (no live linking) — chosen in the master plan to keep v1 simple. Audio tracks are NOT part of a saved component (only layers + their keyframes). The DB model `SavedComponent` already exists from Stage 1; this stage adds its Zod schema, endpoints, and UI.

**Goal:** User selects 1+ layers in the active scene, names a component, sees it appear in a sidebar list of Components, opens another project, drags the component into a scene, and the same layers + animations reappear with frames re-based to the current scrubber position.

**Architecture:** A `SavedComponentPayload` is a normalized snapshot of selected layers, where (a) all layer IDs are kept as-is in storage but cloned with fresh IDs at insert time, (b) the earliest `startFrame` among selected layers is shifted to 0 so the component is "frame-zero anchored", and (c) keyframes (which are already layer-local in our schema since Stage 4) are preserved unchanged. On insert, a `currentFrame` offset is added to all layer `startFrame`/`endFrame`, and IDs are regenerated so multiple instances of the same component coexist in one project. The save dialog shows a checkbox list of layers in the active scene; no multi-select drag needed in the main UI. Thumbnails are an OPTIONAL polish (`html2canvas` capture of the Player) — payload + name + category are sufficient for v1 utility.

**Tech Stack additions:** `html2canvas` (optional thumbnail) · existing shared-types schemas + Zustand store + shadcn primitives.

---

## Acceptance criteria → tasks map (Stage 7 master ACs)

| Master AC | Tasks |
|---|---|
| 1. `SavedComponent` model (DB exists) + Zod schema | T1 |
| 2. POST/GET/DELETE `/api/components` | T2, T3 |
| 3. UI: select layers + "Save as component" dialog | T4, T5 |
| 4. Sidebar Components tab + thumbnails | T6, T9 |
| 5. Click/drag to insert | T7 |
| 6. Frame re-basing on insert; ID regeneration | T4 (save), T7 (insert) |
| 7. Cross-project insertion | T10 |

---

## File structure to create

```
packages/shared-types/
├── src/
│   ├── schemas/
│   │   └── savedComponent.ts                 # NEW
│   └── index.ts                              # MODIFY: barrel
└── tests/
    └── schemas.test.ts                       # MODIFY: SavedComponent cases

apps/web/
├── src/
│   ├── lib/
│   │   └── components/
│   │       ├── normalizePayload.ts           # NEW: layers → frame-zero anchored snapshot
│   │       └── instantiatePayload.ts         # NEW: snapshot → fresh layers at currentFrame
│   ├── editor/
│   │   ├── store.ts                          # MODIFY: insertSavedComponent action
│   │   ├── store.types.ts                    # MODIFY
│   │   └── components/
│   │       ├── Sidebar.tsx                   # MODIFY: add Components tab
│   │       ├── ComponentsPanel.tsx           # NEW
│   │       ├── SaveComponentDialog.tsx       # NEW
│   │       └── inspector/
│   │           └── PropsTab.tsx              # MODIFY: add "Save as component…" button
│   ├── app/
│   │   └── api/components/
│   │       ├── route.ts                      # GET (list), POST (create)
│   │       └── [id]/route.ts                 # DELETE
└── tests/
    ├── lib/components/
    │   ├── normalizePayload.test.ts          # NEW
    │   └── instantiatePayload.test.ts        # NEW
    └── api/
        └── components.test.ts                # NEW
```

---

## Task list (execution order)

### Task 1: `SavedComponent` Zod schema (TDD)

**Files:**
- Create: `packages/shared-types/src/schemas/savedComponent.ts`
- Modify: `packages/shared-types/src/index.ts`, `tests/schemas.test.ts`

- [x] **Step 1:** Failing tests:
  - Valid payload: `{ layers: [validLayerA, validLayerB] }` parses.
  - Empty layers array rejected (component must have ≥1 layer).
  - Each layer in payload validates against `LayerSchema` (re-uses Stage 2).
  - SavedComponent metadata: `{ id, name, category?: string, preview?: string, payload }` parses.
  - `name` must be non-empty.
- [x] **Step 2:** Implement `savedComponent.ts`:
  ```ts
  import { z } from "zod";
  import { LayerSchema } from "./layer";

  export const SavedComponentPayloadSchema = z.object({
    layers: z.array(LayerSchema).min(1)
  });

  export const SavedComponentSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    category: z.string().nullable().optional(),
    preview: z.string().nullable().optional(),
    payload: SavedComponentPayloadSchema,
    createdAt: z.coerce.date().optional()
  });

  export type SavedComponentPayload = z.infer<typeof SavedComponentPayloadSchema>;
  export type SavedComponent = z.infer<typeof SavedComponentSchema>;
  ```
- [x] **Step 3:** Update barrel `export * from "./schemas/savedComponent";`.
- [x] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit: `feat(shared-types): SavedComponent schema`.

---

### Task 2: `POST` and `GET /api/components`

**Files:**
- Create: `apps/web/src/app/api/components/route.ts`, `apps/web/tests/api/components.test.ts`

- [x] **Step 1:** Failing tests:
  - POST with valid `{ name, category?, payload }` returns 201 + the saved component.
  - POST with empty `payload.layers` returns 400.
  - GET returns array sorted by `createdAt desc`; supports optional `?category=foo` filter.
- [x] **Step 2:** Implement:
  ```ts
  import { NextResponse } from "next/server";
  import { z } from "zod";
  import { db } from "@/lib/db";
  import { SavedComponentPayloadSchema } from "@open-effects/shared-types";

  const CreateBody = z.object({
    name: z.string().min(1),
    category: z.string().nullable().optional(),
    preview: z.string().nullable().optional(),
    payload: SavedComponentPayloadSchema
  });

  export async function POST(req: Request) {
    const parsed = CreateBody.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { name, category, preview, payload } = parsed.data;
    const c = await db.savedComponent.create({
      data: { name, category: category ?? null, preview: preview ?? null, payload }
    });
    return NextResponse.json(c, { status: 201 });
  }

  export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const where = category ? { category } : {};
    const list = await db.savedComponent.findMany({ where, orderBy: { createdAt: "desc" } });
    return NextResponse.json(list);
  }
  ```
- [x] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(api): POST/GET /api/components`.

---

### Task 3: `DELETE /api/components/:id`

**Files:**
- Create: `apps/web/src/app/api/components/[id]/route.ts`

- [x] **Step 1:** Implement:
  ```ts
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";

  export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    await db.savedComponent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
  ```
- [x] **Step 2:** Add a test: create + delete + verify gone.
- [ ] **Step 3:** Commit: `feat(api): DELETE /api/components/[id]`.

**Note:** since components are snapshots, deleting a SavedComponent never affects existing project data — instances are independent copies.

---

### Task 4: `normalizePayload` (TDD)

**Files:**
- Create: `apps/web/src/lib/components/normalizePayload.ts`, `tests/lib/components/normalizePayload.test.ts`

- [x] **Step 1:** Failing tests:
  - Single layer with `startFrame: 10, endFrame: 40` and keyframes at local frames `[0, 15, 30]` → output layer has `startFrame: 0, endFrame: 30`; keyframes unchanged.
  - Two layers: A `[startFrame: 5, endFrame: 25]`, B `[startFrame: 12, endFrame: 60]` → min start = 5, output A `[0, 20]`, output B `[7, 55]`.
  - Output layers re-numbered with `order` 0, 1, 2... in the same relative order.
  - Layer IDs preserved in payload (regenerated only at insert time, Task 6).
- [x] **Step 2:** Implement:
  ```ts
  import type { Layer } from "@open-effects/shared-types";
  export function normalizePayload(layers: Layer[]): { layers: Layer[] } {
    if (layers.length === 0) throw new Error("normalizePayload requires ≥1 layer");
    const minStart = Math.min(...layers.map((l) => l.startFrame));
    const sorted = [...layers].sort((a, b) => a.order - b.order);
    return {
      layers: sorted.map((l, i) => ({
        ...l,
        order: i,
        startFrame: l.startFrame - minStart,
        endFrame: l.endFrame - minStart
        // keyframes already layer-local (Stage 4), no change needed
      }))
    };
  }
  ```
- [x] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(components): normalizePayload`.

---

### Task 5: `instantiatePayload` (TDD)

**Files:**
- Create: `apps/web/src/lib/components/instantiatePayload.ts`, `tests/lib/components/instantiatePayload.test.ts`

- [x] **Step 1:** Failing tests:
  - Payload with 1 layer at `[0, 30]` instantiated at `currentFrame: 100` → new layer `[100, 130]` with a fresh `id` (different from payload's).
  - Payload with 2 layers at `[0, 20]` and `[7, 55]` at `currentFrame: 50` → `[50, 70]` and `[57, 105]`.
  - Each keyframe in the new layers has a fresh `id` (different from payload's keyframe ids).
  - `existingMaxOrder` is honored: layers are inserted with `order = existingMaxOrder + 1, +2, ...` so they sit on top of existing layers.
- [x] **Step 2:** Implement:
  ```ts
  import type { SavedComponentPayload, Layer } from "@open-effects/shared-types";
  import { newId } from "@/lib/ids";

  export function instantiatePayload(
    payload: SavedComponentPayload,
    opts: { currentFrame: number; existingMaxOrder: number }
  ): Layer[] {
    return payload.layers.map((l, i) => ({
      ...l,
      id: newId(),
      order: opts.existingMaxOrder + 1 + i,
      startFrame: l.startFrame + opts.currentFrame,
      endFrame: l.endFrame + opts.currentFrame,
      keyframes: l.keyframes.map((k) => ({ ...k, id: newId() }))
    }));
  }
  ```
- [x] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(components): instantiatePayload`.

---

### Task 6: Store action `insertSavedComponent`

**Files:**
- Modify: `apps/web/src/editor/store.ts`, `store.types.ts`

- [x] **Step 1:** Add to actions:
  ```ts
  insertSavedComponent: (payload: SavedComponentPayload, sceneId?: string) => void;
  ```
- [x] **Step 2:** Implement:
  ```ts
  insertSavedComponent: (payload, sceneId) => set((s) => {
    const targetSceneId = sceneId ?? s.selectedSceneId ?? s.project.scenes[0]?.id;
    if (!targetSceneId) return;
    const sc = s.project.scenes.find((x) => x.id === targetSceneId);
    if (!sc) return;
    const existingMaxOrder = sc.layers.reduce((m, l) => Math.max(m, l.order), -1);
    const newLayers = instantiatePayload(payload, {
      currentFrame: s.currentFrame,
      existingMaxOrder
    });
    sc.layers.push(...newLayers);
  })
  ```
- [x] **Step 3:** Quick test: starting from a 0-layer scene, after `insertSavedComponent(payload, sceneId)` the scene has the expected number of layers with re-based frames.
- [ ] **Step 4:** Commit: `feat(editor): insertSavedComponent action`.

---

### Task 7: SaveComponentDialog UI

**Files:**
- Create: `apps/web/src/editor/components/SaveComponentDialog.tsx`
- Modify: `apps/web/src/editor/components/inspector/PropsTab.tsx` (add trigger button)

- [x] **Step 1:** Implement dialog:
  - Trigger: "Save as component…" button visible in PropsTab (when a layer is selected, the button defaults to selecting just that layer; otherwise the button is in a Topbar menu — for simplicity, put it in the Layers panel header).
  - Body:
    - Name input (required).
    - Category input (optional).
    - List of layers in the active scene with checkboxes; the currently-selected layer is pre-checked.
  - "Save" button: gathers checked layers from the active scene, runs `normalizePayload(checkedLayers)`, POSTs to `/api/components`, on success closes dialog and shows toast.
- [x] **Step 2:** Manual: select 2 layers via checkboxes, save with name "MyComp", verify toast + appearance in next task's panel.
- [ ] **Step 3:** Commit: `feat(editor): SaveComponentDialog`.

---

### Task 8: ComponentsPanel sidebar tab

**Files:**
- Modify: `apps/web/src/editor/components/Sidebar.tsx`
- Create: `apps/web/src/editor/components/ComponentsPanel.tsx`

- [x] **Step 1:** Add a "Components" tab to the sidebar (4th tab beside Scenes / Layers / Assets).
- [x] **Step 2:** Implement `ComponentsPanel.tsx`:
  - On mount: fetch `/api/components`. Local state list. Polling/refresh on dialog success (use Zustand event or `mutate` pattern; simplest: pass a `refresh` callback to SaveComponentDialog).
  - Render grid (2 columns) of cards: thumbnail or fallback initial; name; category badge.
  - Card actions: "Insert" button (calls `insertSavedComponent(payload)`), "Delete" (with confirm).
  - Drag source: also allow dragging the card onto the scenes panel or canvas; for v1 the click-to-insert is sufficient — drag is optional polish.
- [ ] **Step 3:** Manual: open Components tab, see saved component, click "Insert" → layers appear in active scene at `currentFrame`.
- [ ] **Step 4:** Commit: `feat(editor): ComponentsPanel`.

---

### Task 9: Optional thumbnail capture

**Files:**
- Modify: `apps/web/src/editor/components/SaveComponentDialog.tsx`

- [x] **Step 1:** `npm install html2canvas -w apps/web`.
- [x] **Step 2:** Before POST, capture a snapshot of the current Player canvas:
  ```ts
  import html2canvas from "html2canvas";
  const playerEl = document.querySelector('[data-remotion-canvas]') as HTMLElement | null;
  let preview: string | undefined;
  if (playerEl) {
    const canvas = await html2canvas(playerEl, { useCORS: true, scale: 0.4 });
    preview = canvas.toDataURL("image/png"); // base64 data URL
  }
  ```
- [x] **Step 3:** Server-side, if `preview` is a data URL, decode and write to `apps/web/public/components/<componentId>.png`; replace `preview` field with the public URL `/components/<id>.png`. Add a small `lib/components/saveThumbnail.ts` with this logic.
- [x] **Step 4:** Render the thumbnail in `ComponentsPanel` with `<img src={component.preview}>` if present, otherwise the fallback initial.
- [ ] **Step 5:** Manual: save a component, verify a thumbnail PNG appears in `public/components/` and renders in the panel.
- [ ] **Step 6:** Commit: `feat(editor): thumbnail capture for saved components`.

**Note:** Remotion's Player renders inside an iframe in some configurations. If `html2canvas` fails to capture the iframe content (cross-origin), accept this as a v1 limitation — fallback initial works fine. The capture only triggers if the element exists. Document the limitation in the panel ("thumbnails available when the project's preview is on screen").

---

### Task 10: Cross-project insertion (manual verification)

- [ ] **Step 1:** Create project A. Add 2 animated layers (e.g., one fading + sliding, one with color animation). Save as component "AnimSet".
- [ ] **Step 2:** Create project B (different aspect ratio if you want to stress positioning).
- [ ] **Step 3:** Open project B, scrub to frame 60, click "Insert" on AnimSet.
- [ ] **Step 4:** Verify: 2 new layers appear in B's active scene with `startFrame ≥ 60`, animations play identically (same easings, same value deltas).
- [ ] **Step 5:** Reload project B → component instances persist.
- [ ] **Step 6:** Delete AnimSet from the Components panel → existing instances in A and B remain unaffected (snapshot semantics).

---

### Task 11: Stage closure verification

- [x] **Step 1:** `npm test --workspaces --if-present` → all green. _(264 passed + 3 skipped: web 154/3-skip, runtime 64, shared-types 46)_
- [x] **Step 2:** `npm run typecheck --workspaces --if-present` → clean. _(apps/web ✓, shared-types ✓; runtime has the same pre-existing error in `tests/offset.test.ts` from commit `aff5de5`, unrelated to Stage 7)_
- [ ] **Step 3:** Manual smoke (Task 10) — deferred to user (requires running dev server + multi-project scenario).
- [ ] **Step 4:** Tag closure: `git commit -m "STAGE-7: closed"`. _(orchestrator does not auto-commit — produced as the closure commit by /run-plan)_

---

## Test summary

| Test | Type | File |
|---|---|---|
| `SavedComponentPayloadSchema` + `SavedComponentSchema` | unit | `shared-types/tests/schemas.test.ts` |
| `POST/GET/DELETE /api/components` | integration | `web/tests/api/components.test.ts` |
| `normalizePayload` (≥3 cases incl. multi-layer) | unit | `web/tests/lib/components/normalizePayload.test.ts` |
| `instantiatePayload` (≥4 cases incl. fresh IDs) | unit | `web/tests/lib/components/instantiatePayload.test.ts` |
| `insertSavedComponent` store action | unit | added to `web/tests/editor/store.test.ts` |
| Cross-project insertion smoke | manual | browser |

---

## Risks specific to Stage 7

| Risk | Mitigation |
|---|---|
| `endFrame > scene.durationFrames` after insert (instance overflows scene) | Acceptable visually (Remotion clips at scene end). UX hint in Stage 9 polish: warn user; offer "Adjust scene duration" quick action. |
| Pasting a component into a scene whose Layer schema diverged in a future migration | Both source and destination use the same `LayerSchema` from `shared-types` — no version mismatch in v1. If `LayerSchema` evolves later, add a `payload.schemaVersion` field then. |
| HTML in component references project-specific assets that don't exist in target project | The asset filesystem is global to the deployment (single user, single disk), so URLs resolve. Documented constraint. If multi-tenancy comes later, components would need an embedded `assets[]` manifest. |
| Thumbnail capture cross-origin failure | Fallback initial in panel — non-blocking. Documented in T9. |
| Two simultaneous "Save as component" with the same name | Allowed (no unique constraint on `name`). UI in Components panel disambiguates by createdAt + category. Deduping is a v2 concern. |
| Component with 0 keyframes inserted at `currentFrame` works but the layer's `startFrame > 0` may make it invisible if scrubber moves before it | Standard Remotion semantics; not a defect. |
| Re-using IDs across instances (Immer's structural sharing on multi-insert) | `instantiatePayload` calls `newId()` per layer and keyframe — fresh IDs guaranteed (T5 step 1 tests this). |

---

## Handoff to Stage 8 and Stage 9

**Stage 8** (MP4 render) is independent of saved components — it renders whatever the project JSON contains, regardless of whether layers came from manual creation or saved-component instantiation.

**Stage 9** (Polish) may add:
- Multi-select layers in the LayersPanel via Shift/Ctrl click → simplifies the SaveComponentDialog (pre-checks selected).
- Drag-to-canvas for components (vs click-only).
- Warning toast when an inserted component overflows the active scene's duration.
- Search/filter in ComponentsPanel.

Stage 7 contracts that future stages must respect:
- Snapshot semantics: editing a SavedComponent does NOT affect existing instances. Confirmed by no DB foreign key from `Layer` back to `SavedComponent`.
- `insertSavedComponent` always generates fresh IDs — assume no collision risk.

---

## Final task checklist (execution order)

- [x] T1 — `SavedComponent` Zod schema (TDD)
- [x] T2 — `POST/GET /api/components`
- [x] T3 — `DELETE /api/components/[id]`
- [x] T4 — `normalizePayload` (TDD)
- [x] T5 — `instantiatePayload` (TDD)
- [x] T6 — `insertSavedComponent` store action
- [x] T7 — SaveComponentDialog
- [x] T8 — ComponentsPanel sidebar
- [x] T9 — (optional) thumbnail capture
- [ ] T10 — Cross-project verification (deferred to user — manual)
- [x] T11 — Stage closure (automated portion: tests + typecheck; manual smoke deferred to user)

**Total tasks:** 11 · **Estimate:** 1.5 weeks · **Critical risks:** none blocking; thumbnail capture is the only fragile piece and is optional.
