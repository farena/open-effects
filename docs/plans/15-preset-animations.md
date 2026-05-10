# Preset Animations Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution and validation.

**Goal:** Add a "Presets" tab to the layer inspector that lets users apply parametric animation recipes (categorized IN / OUT / EFFECT) to the selected layer, configurable in duration / easing / values before apply, materializing real keyframes that are subsequently editable like any manual keyframe. The built-in catalog ships with 24 presets — 12 originals plus 12 inspired by [animista.net](https://animista.net/) — covering entrances, exits, and attention-seeker effects.

**Architecture:** Built-in catalog defined in code (no DB / no API / no schema changes). A pure builder function expands `(preset, params, layer)` into `Keyframe[]` anchored according to category. A new store action mutates `layer.keyframes` via the existing `mutateLayer` helper inside the existing `temporal()` → `immer()` middleware stack — undo/redo is automatic. UI is a new vertical-tab in `LAYER_TABS` with two states (catalog grid → configuration panel) and reuses the existing `EasingEditor` and `ConfirmDialog`.

**Tech Stack:** Next.js 15, TypeScript, Zustand 4 (`temporal` + `immer`), Tailwind, Radix UI (shadcn/ui), lucide-react, Vitest. No new dependencies.

---

## Scope check

In scope:
- Built-in catalog (24 presets: 9 IN, 8 OUT, 7 EFFECT — half originals, half animista-inspired).
- Configuration panel (duration, easing, values, anchor for EFFECT).
- Apply → materialize keyframes in `layer.keyframes`, undoable.
- Collision detection + confirm dialog (replace / keep both / cancel).
- New tab in `LAYER_TABS`, hidden when no layer selected.

Out of scope (deferred):
- User-created presets (CRUD).
- Sharing presets across users / projects.
- Animated mini-preview in cards.
- Tracking the preset post-apply.
- Presets that emit `$VARS` (custom keyframes).
- Changes to runtime, schemas, DB, or API.

---

## File structure

### New files

| Path | Responsibility |
|------|---------------|
| `apps/web/src/editor/presets/types.ts` | `PresetCategory`, `PresetParam`, `BuildContext`, `AnimationPreset`, `PresetConflict` types. |
| `apps/web/src/editor/presets/animation-presets.ts` | Built-in catalog (≥12 entries). Each preset declares defaults and a `build` function. |
| `apps/web/src/editor/presets/build-keyframes.ts` | Pure `buildPresetKeyframes(preset, ctx)` — computes anchor frame per category, clamps duration to layer length, calls `preset.build`. |
| `apps/web/src/editor/presets/detect-conflicts.ts` | Pure `detectPresetConflicts(layer, preset, ctx)` — returns properties of `layer.keyframes` that overlap the target range. |
| `apps/web/tests/editor/presets/build-keyframes.test.ts` | Vitest unit tests for `buildPresetKeyframes` (anchors, clamp, all 3 categories, all 24 presets smoke). |
| `apps/web/tests/editor/presets/detect-conflicts.test.ts` | Vitest unit tests for collision detection. |
| `apps/web/src/editor/components/inspector/PresetsTab.tsx` | UI: catalog state (chip selector + card grid) and configuration state (duration, EasingEditor, values, anchor for EFFECT, Apply). Wires `ConfirmDialog` for collision flow. |

### Modified files

| Path | Change |
|------|--------|
| `apps/web/src/editor/components/Inspector.tsx` (~line 103, `LAYER_TABS`) | Add `{ value: "presets", label: "Presets", Icon: Sparkles }` and add `presets: <PresetsTab layer={activeLayer} />` to the tab content map. |
| `apps/web/src/editor/store.ts` | Add action `applyAnimationPresetToLayer(layerId, preset, params, options)` using `mutateLayer`. `options.replaceConflicts` controls behavior on collision. Returns void; conflict detection is the caller's responsibility (UI calls `detectPresetConflicts` first). |
| `apps/web/tests/editor/store.preset.test.ts` (new) | Vitest tests for the action: apply IN at startFrame; apply OUT anchored at endFrame; apply with `replaceConflicts: true` removes overlapping property keyframes; undo restores. |

### NOT touched

- `packages/shared-types/**`
- `packages/runtime/**`
- `apps/web/prisma/**`
- `apps/web/src/app/api/**`

---

## Conventions

- **Tests live under `apps/web/tests/`** (NOT co-located with source — see `CLAUDE.md` "Conventions"). Mirror the source path: code in `apps/web/src/editor/presets/foo.ts` → test in `apps/web/tests/editor/presets/foo.test.ts`. Vitest is configured workspace-wide; run with `npm test -w apps/web` from the repo root, or a single file with `npm test -w apps/web -- tests/editor/presets/build-keyframes.test.ts`.
- **IDs**: use `newId()` from `apps/web/src/lib/ids.ts` for keyframe IDs (cuid2).
- **Easing reuse**: import `Easing` type from `@open-effects/shared-types` (or `packages/shared-types/src/schemas/easing.ts`). The `Easing` discriminated union is: `linear`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier` with `params: [n,n,n,n]`, and `spring` with `params: { damping: number; stiffness: number; mass: number }`. **Spring `params` is a nested object — do not flatten it.** Reuse `EasingEditor` from `apps/web/src/editor/components/inspector/EasingEditor.tsx` (props: `easing`, `onSave`).
- **Layer / Keyframe types**: import from `@open-effects/shared-types` (or `packages/shared-types/src/schemas/{layer,keyframe}.ts`).
- **Property strings (CRITICAL)**: presets MUST emit only properties listed in `packages/runtime/src/keyframes/propertyRegistry.ts` (`PROPERTIES` map). The store rejects unknown properties. Available animatable keys for our presets: `opacity` (numeric, default `"1"`), `transform.translateX` (length-px, default `"0px"`), `transform.translateY` (length-px, default `"0px"`), `transform.scale` (numeric, default `"1"`), `transform.rotate` (angle-deg, default `"0deg"`). **Translate is in pixels, not percentages** — use values like `"-300px"` not `"-100%"`. Scale is dimensionless number-string. Rotate ends in `deg`.
- **Store mutation**: use the existing `mutateLayer(layerId, fn)` helper inside `useEditorStore` (same pattern as `addKeyframe` at `apps/web/src/editor/store.ts:314`).
- **Icons**: `Sparkles` from `lucide-react` (already used in `Topbar.tsx`).
- **Dialog**: reuse `ConfirmDialog` at `apps/web/src/editor/components/ConfirmDialog.tsx` for 2-button cases; use raw `Dialog` from `apps/web/src/components/ui/dialog.tsx` for the 3-button collision case in Task 9.
- **Lint / typecheck**: `npm run lint -w apps/web` and `npm run typecheck -w apps/web` from repo root.

---

## Type contracts (authoritative — do not invent variants)

```ts
// apps/web/src/editor/presets/types.ts
import type { Easing } from "@open-effects/shared-types/schemas/easing";
import type { Layer, Keyframe } from "@open-effects/shared-types/schemas/layer";

export type PresetCategory = "in" | "out" | "effect";

export type PresetParam =
  | { kind: "number"; key: string; label: string; default: number; min?: number; max?: number; unit?: string }
  | { kind: "text";   key: string; label: string; default: string };

export type BuildContext = {
  layer: Layer;
  duration: number;          // clamped frames
  easing: Easing;
  anchorFrame: number;       // resolved per category
  values: Record<string, number | string>;
};

export type AnimationPreset = {
  key: string;               // 'fade-in', stable identifier
  name: string;              // human label
  category: PresetCategory;
  iconKey: string;           // lucide icon name (resolved in UI)
  defaultDuration: number;   // frames
  defaultEasing: Easing;
  params: PresetParam[];
  animatedProperties: string[]; // properties this preset emits keyframes for; used by collision detection
  build: (ctx: BuildContext) => Keyframe[];   // returns keyframes WITHOUT id; ids assigned by builder
};

export type PresetConflict = {
  property: string;
  existingFrames: number[];   // frames in [anchor, anchor+duration]
};
```

The pure builder wraps `preset.build` and assigns ids:

```ts
// apps/web/src/editor/presets/build-keyframes.ts
export function buildPresetKeyframes(
  preset: AnimationPreset,
  ctx: BuildContext
): Keyframe[]
```

Anchor resolution (in `buildPresetKeyframes`, before calling `preset.build`):

| category | anchorFrame |
|----------|-------------|
| `in` | `layer.startFrame` |
| `out` | `layer.endFrame - duration` (min `layer.startFrame`) |
| `effect` | caller-provided (default = midpoint = `floor((startFrame + endFrame) / 2)`) |

Duration clamp: `min(requestedDuration, endFrame - startFrame)`.

Conflict detection range is `[anchorFrame, anchorFrame + duration]` inclusive.

---

## Tasks

### Task 1: Types module

**Files:**
- Create: `apps/web/src/editor/presets/types.ts`

- [ ] **Step 1:** Define `PresetCategory`, `PresetParam`, `BuildContext`, `AnimationPreset`, `PresetConflict` exactly as specified in the "Type contracts" section above. Import `Easing`, `Layer`, `Keyframe` from `@open-effects/shared-types`.
- [ ] **Step 2:** Run `npx tsc --noEmit` from `apps/web` and confirm no errors.
- [ ] **Step 3:** Commit with message: `feat(presets): add animation preset type contracts`.

> No tests in this task — pure type definitions.

---

### Task 2: Anchor + clamp logic in `buildPresetKeyframes`

**Files:**
- Create: `apps/web/src/editor/presets/build-keyframes.ts`
- Create: `apps/web/tests/editor/presets/build-keyframes.test.ts`

- [ ] **Step 1: Write failing test** covering:
  - IN preset → `anchorFrame === layer.startFrame`.
  - OUT preset with `duration <= endFrame - startFrame` → `anchorFrame === layer.endFrame - duration`.
  - OUT preset with `duration > endFrame - startFrame` → duration clamped, `anchorFrame === layer.startFrame`.
  - EFFECT preset with explicit `anchorFrame` → uses caller value.
  - EFFECT preset without explicit `anchorFrame` → midpoint `floor((startFrame + endFrame) / 2)`.
  - All keyframes returned have ids (via `newId()`) and `frame >= layer.startFrame && frame <= layer.endFrame`.
  Use a stub preset with a trivial `build` that returns `[{ frame: anchor, property: "opacity", value: "0", easingOut: { type: "linear" } }, { frame: anchor + duration, property: "opacity", value: "1", easingOut: { type: "linear" } }]` (no id).
- [ ] **Step 2: Run test, confirm fail** with `npm test -w apps/web -- tests/editor/presets/build-keyframes.test.ts`.
- [ ] **Step 3: Implement** `buildPresetKeyframes`:
  1. Clamp duration: `const layerLen = layer.endFrame - layer.startFrame; const dur = Math.min(ctx.duration, layerLen);`.
  2. Resolve anchor per category (use rules in "Type contracts" section). For EFFECT, if caller passes `anchorFrame`, respect it; otherwise compute midpoint.
  3. Call `preset.build({ ...ctx, duration: dur, anchorFrame: resolvedAnchor })`.
  4. Map each returned keyframe to `{ ...kf, id: newId() }`.
- [ ] **Step 4: Run test, confirm pass**.
- [ ] **Step 5: Commit** `feat(presets): add buildPresetKeyframes with category-aware anchors and clamping`.

---

### Task 3: Conflict detection

**Files:**
- Create: `apps/web/src/editor/presets/detect-conflicts.ts`
- Create: `apps/web/tests/editor/presets/detect-conflicts.test.ts`

- [ ] **Step 1: Write failing test** covering:
  - No existing keyframes → returns `[]`.
  - Existing keyframe on same property outside `[anchor, anchor+duration]` → returns `[]`.
  - Existing keyframe on same property inside the range → returns one `PresetConflict` with that frame.
  - Multiple existing keyframes on different properties (some in `preset.animatedProperties`, some not) inside the range → returns conflicts only for properties listed in `animatedProperties`.
- [ ] **Step 2: Run test, confirm fail**.
- [ ] **Step 3: Implement** `detectPresetConflicts(layer, preset, ctx) → PresetConflict[]`:
  - Resolve `anchor` and `duration` exactly as in Task 2 (extract a small private helper or share via module).
  - Filter `layer.keyframes` to those whose `property ∈ preset.animatedProperties` and `frame ∈ [anchor, anchor+duration]`.
  - Group by property, return one entry per property with sorted `existingFrames`.
- [ ] **Step 4: Run test, confirm pass**.
- [ ] **Step 5: Commit** `feat(presets): add preset conflict detection`.

> If you find yourself duplicating the anchor/clamp logic across `build-keyframes.ts` and `detect-conflicts.ts`, extract a small helper `resolveAnchor(layer, preset, ctx)` into a shared module. Don't duplicate.

---

### Task 4: Built-in catalog (skeleton — fade-in only)

**Files:**
- Create: `apps/web/src/editor/presets/animation-presets.ts`

- [ ] **Step 1:** Define `ANIMATION_PRESETS: readonly AnimationPreset[]` containing **only `fade-in`** for now (rest added in Task 5). `fade-in`:
  - `key: "fade-in"`, `name: "Fade In"`, `category: "in"`, `iconKey: "fade"`.
  - `defaultDuration: 30`.
  - `defaultEasing: { type: "ease-out" }` (or `{ type: "linear" }` if `ease-out` is not in the Easing schema — verify against `packages/shared-types/src/schemas/easing.ts` and pick the closest valid).
  - `params: [{ kind: "number", key: "fromOpacity", label: "From", default: 0, min: 0, max: 1 }, { kind: "number", key: "toOpacity", label: "To", default: 1, min: 0, max: 1 }]`.
  - `animatedProperties: ["opacity"]`.
  - `build`: returns 2 keyframes for property `"opacity"` at `anchorFrame` and `anchorFrame + duration` with values `String(values.fromOpacity)` and `String(values.toOpacity)`, both with `easingOut: ctx.easing`.
- [ ] **Step 2:** Run `npx tsc --noEmit`, confirm no errors.
- [ ] **Step 3: Commit** `feat(presets): scaffold built-in catalog with fade-in`.

---

### Task 5: Catalog — original 11 presets (round 1)

**Files:**
- Modify: `apps/web/src/editor/presets/animation-presets.ts`
- Modify: `apps/web/tests/editor/presets/build-keyframes.test.ts` (add coverage)

For each preset below, add to the catalog. **All `build` functions must produce keyframes with frames in `[anchorFrame, anchorFrame + duration]` and easingOut from `ctx.easing`.**

| key | category | properties | params | build outline |
|-----|----------|-----------|--------|---------------|
| `slide-in-left` | in | `transform.translateX` | `fromX` (default `-300`, unit `px`) | kf at anchor `"-300px"` → kf at anchor+dur `"0px"` |
| `slide-in-right` | in | `transform.translateX` | `fromX` (default `300`, unit `px`) | symmetric to above |
| `scale-in` | in | `transform.scale` | `fromScale` (default `0.8`), `toScale` (default `1`) | scale string `"0.8"` → `"1"` at anchor and anchor+dur |
| `pop-in` | in | `transform.scale`, `opacity` | `fromScale` (default `0.6`) | scale `"0.6"`→`"1"` + opacity `"0"`→`"1"`, both pairs at anchor and anchor+dur |
| `fade-out` | out | `opacity` | `fromOpacity`=1, `toOpacity`=0 | opacity `"1"`→`"0"` |
| `slide-out-left` | out | `transform.translateX` | `toX` (default `-300`, unit `px`) | translateX `"0px"` → `"-300px"` |
| `slide-out-right` | out | `transform.translateX` | `toX` (default `300`, unit `px`) | symmetric |
| `scale-out` | out | `transform.scale` | `fromScale`=1, `toScale`=0.8 | mirror of scale-in |
| `pulse` | effect | `transform.scale` | `peakScale` (default `1.1`) | 3 keyframes: anchor `"1"`, anchor+dur/2 `String(peakScale)`, anchor+dur `"1"` |
| `shake` | effect | `transform.translateX` | `amplitude` (default `8`, unit `px`) | 5 keyframes alternating `"+8px"/"-8px"` across the range |
| `wiggle` | effect | `transform.rotate` | `amplitude` (default `5`, unit `deg`) | 5 keyframes alternating `"+5deg"/"-5deg"` across the range, like shake but rotation |

**Property naming**: verify the property string format the runtime uses. Search for an existing keyframe in `packages/runtime/src/keyframes/` or in fixture data. If transform sub-properties like `transform.translateX` are not what the runtime parses, use whatever string the runtime already supports (e.g., `translateX`). Match the convention used by existing keyframes — do not invent a new one.

- [ ] **Step 1: Write a failing test** in `build-keyframes.test.ts` that iterates `ANIMATION_PRESETS` and asserts: each preset produces ≥2 keyframes with `default` params on a sample 120-frame layer; all returned `easingOut` equal `ctx.easing`; all returned frames are in range; no `id` is `undefined` after `buildPresetKeyframes` wraps them.
- [ ] **Step 2: Run test, confirm fail** (preset entries missing).
- [ ] **Step 3:** Add the 11 presets above following the existing fade-in pattern. Keep each preset minimal — no extra params, no special cases.
- [ ] **Step 4: Run test, confirm pass**. Also verify total count: `ANIMATION_PRESETS.length === 12`.
- [ ] **Step 5: Commit** `feat(presets): add 11 built-in animations across in/out/effect`.

---

### Task 5b: Catalog — animista-inspired presets (round 2, +12 → 24 total)

**Files:**
- Modify: `apps/web/src/editor/presets/animation-presets.ts`
- Modify: `apps/web/tests/editor/presets/build-keyframes.test.ts` (existing iteration test will cover the new entries automatically)

These 12 presets are inspired by recognizable animations from [animista.net](https://animista.net/) (its categories of "entrances", "exits", and "attention seekers"). Names are simplified to match our internal convention (kebab-case, no axis-direction suffixes when ambiguous). Add a top-of-file comment in `animation-presets.ts`: `// A subset of presets in this catalog is inspired by animista.net (entrances/exits/attention-seekers).`

Only properties our runtime interpolates are used: `opacity`, `transform.translateX/translateY`, `transform.scale`, `transform.rotate`. No `clip-path`, no `filter`, no `text-shadow` — those are deferred.

| key | category | source (animista) | properties | params (defaults) | build outline |
|-----|----------|--------------------|-----------|-------------------|---------------|
| `slide-in-up` | in | `slide-in-top` | `transform.translateY` | `fromY` (default `-200`, unit `px`) | translateY `"-200px"` → `"0px"` |
| `slide-in-down` | in | `slide-in-bottom` | `transform.translateY` | `fromY` (default `200`, unit `px`) | translateY `"200px"` → `"0px"` |
| `rotate-in` | in | `rotate-in-center` | `transform.rotate`, `opacity` | `fromAngle` (default `-180`, unit `deg`) | rotate `"-180deg"`→`"0deg"`; opacity `"0"`→`"1"`, both pairs at anchor and anchor+dur |
| `bounce-in` | in | `bounce-in-top` | `transform.scale`, `opacity` | `fromScale` (default `0.3`) | 5 scale keyframes at fractions 0, 0.25, 0.5, 0.75, 1 with values `[fromScale, 1.05, 0.9, 1.03, 1]` (as numeric strings); 2 opacity keyframes `"0"`→`"1"` |
| `slide-out-up` | out | `slide-out-top` | `transform.translateY` | `toY` (default `-200`, unit `px`) | translateY `"0px"` → `"-200px"` |
| `slide-out-down` | out | `slide-out-bottom` | `transform.translateY` | `toY` (default `200`, unit `px`) | translateY `"0px"` → `"200px"` |
| `rotate-out` | out | `rotate-out-center` | `transform.rotate`, `opacity` | `toAngle` (default `180`, unit `deg`) | rotate `"0deg"`→`"180deg"`, opacity `"1"`→`"0"` |
| `bounce-out` | out | `bounce-out` | `transform.scale`, `opacity` | `toScale` (default `0.3`) | inverse of bounce-in (scale `[1, 0.9, 1.05, 0.95, toScale]` at fractions 0, 0.25, 0.5, 0.75, 1; opacity `"1"`→`"0"`) |
| `bounce` | effect | `bounce-top` | `transform.translateY` | `peak` (default `-30`, unit `px`) | 5 translateY keyframes at fractions 0, 0.25, 0.5, 0.75, 1: `["0px", "<peak>px", "0px", "<peak/2>px", "0px"]` |
| `heart-beat` | effect | `heartbeat` | `transform.scale` | `peakScale` (default `1.3`) | 5 keyframes at fractions 0, 0.14, 0.28, 0.42, 1: `[1, peakScale, 1, peakScale, 1]` |
| `swing` | effect | `swing-top-fwd` (Z-axis only) | `transform.rotate` | `amplitude` (default `15`, unit `deg`) | 5 keyframes: `[0, amplitude, -amplitude*0.6, amplitude*0.4, 0]` |
| `flicker` | effect | `flicker-1` | `opacity` | `dimOpacity` (default `0.2`) | 7 keyframes oscillating opacity between `1` and `dimOpacity` at irregular fractions (0, 0.1, 0.15, 0.2, 0.4, 0.6, 1) |

- [ ] **Step 1:** Add the 12 entries above to `ANIMATION_PRESETS`. Use the helpers from Task 5 (e.g., extract a `linearKeyframes(property, frames, values, easing)` helper if not already present — only if you find yourself duplicating across these multi-keyframe presets). Keep each preset's `build` function focused and short.
- [ ] **Step 2:** Run the iteration test from Task 5: `npm test -w apps/web -- tests/editor/presets/build-keyframes.test.ts`. It should now iterate over 24 presets and pass for all of them (every preset returns ≥2 keyframes with `easingOut === ctx.easing` and frames within `[anchor, anchor+duration]`). If a multi-keyframe preset hits the easing assertion (because intermediate keyframes might want their own easing), update the test to assert `easingOut` is some valid `Easing`, not strictly `ctx.easing`. **Default rule**: every keyframe a preset emits uses `ctx.easing`. Do not split easing per intermediate keyframe in v1 — keep it consistent.
- [ ] **Step 3:** Add a focused test asserting `ANIMATION_PRESETS.length === 24` and counts per category: `9 IN`, `8 OUT`, `7 EFFECT`.
- [ ] **Step 4: Run tests, confirm pass**.
- [ ] **Step 5: Commit** `feat(presets): add 12 animista-inspired built-ins (24 total)`.

> Note on `flicker`: 7 keyframes at irregular fractions is a stylistic choice that mimics animista's flicker; if you find the math gets messy, fall back to 5 evenly-spaced keyframes alternating `[1, dim, 1, dim, 1]` — recognizable enough.
>
> Note on `bounce-in` / `bounce-out`: animista uses cubic-bezier easing with overshoot; our `spring` easing achieves a similar feel. The default easing for these two should be `{ type: "spring", params: { damping: 8, stiffness: 100, mass: 1 } }` (note the **nested `params` object** — confirmed against `packages/shared-types/src/schemas/easing.ts`). Use linear / `ease-out` defaults for the rest unless a more expressive default is obvious.

---

### Task 6: Store action — happy path

**Files:**
- Modify: `apps/web/src/editor/store.ts`
- Create: `apps/web/tests/editor/store.preset.test.ts`

- [ ] **Step 1: Write failing test**:
  - Setup: create a minimal `useEditorStore` instance with a project containing a scene with one layer (`startFrame: 0`, `endFrame: 120`, `keyframes: []`).
  - Call `applyAnimationPresetToLayer(layerId, fadeInPreset, { duration: 30, easing: { type: "linear" }, values: { fromOpacity: 0, toOpacity: 1 } })`.
  - Assert: `layer.keyframes.length === 2`, both for property `"opacity"`, frames `[0, 30]`, both have ids.
  - Assert: zundo `pastStates` length increased by 1 (call `useEditorStore.temporal.getState().undo()` and verify `layer.keyframes.length === 0`).
- [ ] **Step 2: Run test, confirm fail**.
- [ ] **Step 3: Implement** action signature:
  ```ts
  applyAnimationPresetToLayer(
    layerId: string,
    preset: AnimationPreset,
    params: { duration: number; easing: Easing; values: Record<string, number | string>; anchorFrame?: number; replaceConflicts?: boolean }
  )
  ```
  Body:
  1. Find the layer (read snapshot to build ctx).
  2. Build `ctx: BuildContext = { layer, duration: params.duration, easing: params.easing, anchorFrame: params.anchorFrame ?? -1, values: params.values }`. (`-1` is a sentinel — Task 2's anchor resolver will compute the real value when category != effect, or use the given value when effect.)
  3. Call `buildPresetKeyframes(preset, ctx)` → `newKfs: Keyframe[]`.
  4. Inside `mutateLayer(layerId, l => { ... })`:
     - If `params.replaceConflicts === true`: filter out existing keyframes whose `property ∈ preset.animatedProperties` and `frame ∈ [resolvedAnchor, resolvedAnchor + clampedDuration]`. Re-resolve anchor inside the mutator OR compute it before and pass in via closure.
     - Push `newKfs` into `l.keyframes`.
- [ ] **Step 4: Run test, confirm pass**.
- [ ] **Step 5: Commit** `feat(store): add applyAnimationPresetToLayer action with undo support`.

---

### Task 7: Store action — collision replace mode

**Files:**
- Modify: `apps/web/tests/editor/store.preset.test.ts`
- (Modify `store.ts` only if Task 6 didn't cover replace branch yet.)

- [ ] **Step 1: Write failing test**:
  - Layer with one existing keyframe `{ frame: 15, property: "opacity", value: "0.5", easingOut: { type: "linear" } }`.
  - Apply fade-in (props `["opacity"]`, range `[0, 30]`) with `replaceConflicts: false` → assert layer now has 3 keyframes (existing + 2 new).
  - Reset, apply with `replaceConflicts: true` → assert layer has 2 keyframes (existing one removed).
- [ ] **Step 2: Run test, confirm fail** (or pass if Task 6 already implemented both branches).
- [ ] **Step 3: Implement** the missing branch if needed.
- [ ] **Step 4: Run test, confirm pass**.
- [ ] **Step 5: Commit** `test(store): cover replace-conflicts branch of applyAnimationPresetToLayer`.

---

### Task 8: PresetsTab — catalog state

**Files:**
- Create: `apps/web/src/editor/components/inspector/PresetsTab.tsx`

- [ ] **Step 1:** Implement `<PresetsTab layer={Layer} />` showing only the catalog state:
  - `useState<PresetCategory>("in")` for chip selector.
  - Three chips (IN / OUT / EFFECT) styled like existing chip selectors in the codebase (search `KeyframesTab.tsx` for chip pattern; reuse classnames).
  - Filter `ANIMATION_PRESETS` by current category.
  - Render a 2-column grid of cards. Each card: icon (resolve `iconKey` to a `lucide-react` icon — for v1, a simple mapping `{ fade: Eye, "slide-left": ArrowLeft, ... }` is fine; fall back to `Sparkles`), name, click handler stub `onSelect(preset)`.
  - Card click sets local `selectedPreset` state but renders nothing yet (Task 9 builds the configuration view).
- [ ] **Step 2:** Manually verify by importing it in `Inspector.tsx` (Task 10) — postpone or do a quick local mount in dev to sanity-check rendering. Skip if not feasible.
- [ ] **Step 3: Commit** `feat(presets): scaffold PresetsTab catalog grid`.

---

### Task 9: PresetsTab — configuration state + apply

**Files:**
- Modify: `apps/web/src/editor/components/inspector/PresetsTab.tsx`

- [ ] **Step 1:** When `selectedPreset` is set, render the configuration view instead of the grid:
  - Header: back chevron (`<` icon, click → clear `selectedPreset`) + preset name.
  - **Duration** input: `<Input type="number" min={1} value={duration} onChange=... />` initialized to `selectedPreset.defaultDuration`.
  - **Easing** editor: `<EasingEditor easing={easing} onSave={setEasing} />` initialized to `selectedPreset.defaultEasing`.
  - **Values**: render one input per `selectedPreset.params` entry (number or text per `kind`), initialized to `default`. Local state `values: Record<string, number | string>`.
  - **Anchor** (only if `selectedPreset.category === "effect"`): number input for `anchorFrame`, default = midpoint of layer.
  - Inline warning when `duration > endFrame - startFrame` ("Duration clamped to layer length").
  - Inline note when `easing.type === "spring" && duration < 15` ("Spring may not be visible at this duration").
  - **Apply** button at the bottom.
- [ ] **Step 2:** Apply button handler:
  1. Build `ctx`-shaped params: `{ duration, easing, values, anchorFrame: category === "effect" ? anchorFrame : undefined }`.
  2. Call `detectPresetConflicts(layer, selectedPreset, { ...ctx, anchorFrame: resolved })` (resolve anchor with the same logic — extract a small helper if not done).
  3. If conflicts non-empty: open `ConfirmDialog` with message listing conflicting properties and three actions:
     - **Replace** → call store action with `replaceConflicts: true`, then close dialog and reset to catalog.
     - **Keep both** → call action with `replaceConflicts: false`, then close.
     - **Cancel** → close, no action.
  4. If no conflicts: call action with `replaceConflicts: false`, reset to catalog.
- [ ] **Step 3:** Commit `feat(presets): add configuration panel and apply flow with collision dialog`.

> The `ConfirmDialog` component at `apps/web/src/editor/components/ConfirmDialog.tsx` may only support a 2-button confirm/cancel. If so, use raw `Dialog` from `apps/web/src/components/ui/dialog.tsx` to render 3 buttons. **Do not extend `ConfirmDialog` for this** — keep it focused.

---

### Task 10: Inspector wiring

**Files:**
- Modify: `apps/web/src/editor/components/Inspector.tsx`

- [ ] **Step 1:** Import `Sparkles` from `lucide-react` and `PresetsTab` from `./inspector/PresetsTab`.
- [ ] **Step 2:** Add `{ value: "presets", label: "Presets", Icon: Sparkles }` to `LAYER_TABS` (line ~103). Place after `keyframes`.
- [ ] **Step 3:** Add the `presets` key to the contents map (around lines 142–148) rendering `<PresetsTab layer={activeLayer} />`. Make sure the tab is gated by the same `activeLayer != null` condition that already gates the layer tabs (verify the existing render flow — likely `LAYER_TABS` is only rendered when `activeLayer` exists).
- [ ] **Step 4:** Run `npx tsc --noEmit` and `npm run lint` (if a lint script exists at apps/web).
- [ ] **Step 5: Commit** `feat(inspector): add Presets tab to LAYER_TABS`.

---

### Task 11: Manual smoke test (no code change)

- [ ] **Step 1:** `npm run dev` from `apps/web` (or root if monorepo orchestrates).
- [ ] **Step 2:** Open an existing project with at least one layer. Select a layer.
- [ ] **Step 3:** Verify:
  1. The Presets tab is visible with the Sparkles icon.
  2. Switching IN / OUT / EFFECT filters the grid.
  3. Click `fade-in` → configuration panel appears with Duration=30, easing editor populated, From/To opacity inputs at 0 and 1.
  4. Click Apply → keyframes appear in the timeline; preview shows the fade.
  5. Open Keyframes tab → the two new keyframes are listed and editable.
  6. Apply a second preset (e.g., `slide-in-left`) → new keyframes added on `transform.translateX` (or whatever property string was chosen in Task 5).
  7. Apply `pulse` (EFFECT) → anchor frame defaults to midpoint; keyframes positioned around midpoint.
  8. Apply a preset that overlaps existing keyframes → confirm dialog appears; test all 3 buttons (replace / keep both / cancel) behave correctly.
  9. Cmd/Ctrl+Z (undo) reverses the apply.
  10. Without a layer selected, the Presets tab is hidden (or the inspector falls back to scene/audio tabs as appropriate).
- [ ] **Step 4:** Document any deviation from the acceptance criteria in the PR description.

---

## Acceptance criteria → task map

| AC | Task(s) |
|----|---------|
| 1. Tab "Presets" with Sparkles icon when layer selected | 10, 11 |
| 2. Chip selector IN / OUT / EFFECT | 8 |
| 3. 24 presets (9 IN / 8 OUT / 7 EFFECT) | 4, 5, 5b |
| 4. Configuration panel with duration, EasingEditor, values, anchor for EFFECT | 9 |
| 5. Apply generates keyframes; undoable | 6, 11 |
| 6. Collision → confirm dialog | 7, 9 |
| 7. Catalog read-only | (architectural — `ANIMATION_PRESETS` is `readonly`, no store mutation) |
| 8. Generated keyframes editable in Keyframes tab | 11 (verify only) |
| 9. Preview reflects animation immediately | 11 (verify only) |
| 10. Tab hidden when no layer selected | 10, 11 |

---

## Risks & mitigations

- **Property string mismatch with runtime.** Presets emit property strings (`opacity`, `transform.translateX`, etc.). If the runtime parser expects different strings, presets will appear to apply but nothing animates. **Mitigation:** Task 5 step explicitly says "verify the property string format the runtime uses" — implementator must search existing keyframes / runtime parser before fixing the strings.
- **`mutateLayer` semantics with zundo.** Confirm `mutateLayer` already participates in zundo history (existing `addKeyframe` uses it and produces undoable states — Task 6 test asserts this). If it doesn't, the action must use the same primitive as other undoable mutations.
- **EasingEditor inside another tab.** It's used inside a popover in `KeyframesTab`. Reusing it inline (without popover) should work since it's stateless w.r.t. its container, but verify visually in Task 11.
- **`ConfirmDialog` not supporting 3 buttons.** Task 9 explicitly says: do NOT extend `ConfirmDialog`. Use raw `Dialog` from `apps/web/src/components/ui/dialog.tsx` for the 3-button case.
- **`temporal()` partializing only `project`.** Confirmed in store.ts. Mutating `layer.keyframes` is inside `project` so it's tracked. No risk.

---

## Execution checklist (in order)

Tasks 1 through 5b are **strictly sequential** (types → builders → catalog rounds 1 and 2). Task 5b can run in parallel with Task 6/7 (store) once Task 5 is merged, since 5b only adds catalog entries that the store action consumes generically.

Tasks 8 and 9 are **strictly sequential** within UI; they can start in parallel with Task 6/7/5b if a separate worker takes them, but they need Task 5 (catalog scaffold) and Task 4 (types) merged. The new presets from 5b will appear automatically in the UI grid since the UI iterates `ANIMATION_PRESETS`.

Task 10 depends on Task 9 being merged.

Task 11 is the final manual verification.

```
1 → 2 → 3 → 4 → 5 ─┬─→ 5b ─┐
                   ├─→ 6 → 7 ─┐
                   │           ├─→ 10 → 11
                   └── 8 → 9 ──┘
```

**Parallelizable after Task 5:** {5b}, {6 → 7}, {8 → 9}. Task 10 must wait for 9. Task 11 must wait for 10 and 5b.

---

## Definition of Done

- All tasks above checked off.
- `npx vitest run` passes from `apps/web`.
- `npx tsc --noEmit` passes from `apps/web`.
- All 10 acceptance criteria visually verified in Task 11.
- One commit per task as specified (no squashing within the plan).
