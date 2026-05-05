# Stage 2 — Runtime Engine (minimal) Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read `00-master-plan.md` and `01-foundation-stack.md` first. Stage 1 left `packages/runtime/src/index.ts` and `packages/shared-types/src/index.ts` as `export {}` placeholders — Stage 2 fills them in. The Prisma schema is fixed by Stage 1; do not modify it.

**Goal:** Build the universal Remotion composition `OpenEffectsComposition` that reads a `projectJson` via `inputProps` and renders scenes + layers (HTML+CSS, no animation yet). Same component will later feed both `<Player>` (Stage 3) and `@remotion/renderer` (Stage 8).

**Architecture:** `packages/shared-types` exposes Zod schemas as the single source of truth for the JSON shape. `packages/runtime` consumes those types and provides `OpenEffectsComposition`, `SceneRenderer`, and `Layer`. Layer isolation = `contain: strict` + CSS scoped via `postcss-prefix-selector` + HTML sanitized via `isomorphic-dompurify`. A standalone `Root.tsx` registers fixtures so the engine is demoable in Remotion Studio without the web app.

**Tech Stack:** Remotion v4 (`remotion`, `@remotion/cli`, `@remotion/bundler`) · Zod 3 · isomorphic-dompurify · postcss + postcss-prefix-selector · Vitest + jsdom · @testing-library/react.

---

## Acceptance criteria → tasks map (Stage 2 master ACs)

| Master AC | Tasks |
|---|---|
| 1. `packages/runtime` independently buildable | T1, T17 |
| 2. `OpenEffectsComposition` accepts `inputProps: { project }` and renders scenes via `<Sequence>` | T13, T14 |
| 3. `Layer` renders arbitrary HTML+CSS isolated (`contain: strict` + scoped CSS) | T9, T10, T12 |
| 4. HTML sanitized via DOMPurify | T9, T12 |
| 5. `shared-types` exports Zod schemas; both packages import from there | T2–T8 |
| 6. Resolution and fps come from project JSON | T13 |
| 7. Sample fixtures live in `packages/runtime/fixtures/` | T15 |

---

## File structure to create

```
packages/shared-types/
├── package.json                    # add zod dep
├── src/
│   ├── index.ts                    # re-exports (REPLACE placeholder)
│   ├── schemas/
│   │   ├── easing.ts
│   │   ├── keyframe.ts
│   │   ├── layer.ts
│   │   ├── audio.ts
│   │   ├── scene.ts
│   │   └── project.ts
│   └── types.ts                    # z.infer<>'d types
└── tests/
    └── schemas.test.ts

packages/runtime/
├── package.json                    # add remotion + zod-shared deps
├── tsconfig.json
├── remotion.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts                    # exports (REPLACE placeholder)
│   ├── Root.tsx                    # Studio root: <Composition> registrations
│   ├── OpenEffectsComposition.tsx
│   ├── components/
│   │   ├── SceneRenderer.tsx
│   │   └── Layer.tsx
│   ├── lib/
│   │   ├── sanitizeHtml.ts
│   │   ├── scopeCss.ts
│   │   └── offset.ts
│   └── fixtures/
│       ├── singleScene.ts
│       ├── twoScenes.ts
│       ├── unsafeHtml.ts
│       └── globalCss.ts
└── tests/
    ├── sanitizeHtml.test.ts
    ├── scopeCss.test.ts
    ├── offset.test.ts
    ├── Layer.test.tsx
    └── OpenEffectsComposition.test.tsx
```

---

## Task list (execution order)

### Task 1: Install Remotion + Vitest in `packages/runtime`

**Files:**
- Modify: `packages/runtime/package.json`
- Create: `packages/runtime/remotion.config.ts`, `packages/runtime/vitest.config.ts`

- [ ] **Step 1:** `npm install remotion@4 react@19 react-dom@19 zod@3 isomorphic-dompurify postcss postcss-prefix-selector -w packages/runtime`
- [ ] **Step 2:** `npm install -D @remotion/cli@4 @remotion/bundler@4 vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @types/react @types/react-dom typescript -w packages/runtime`
- [ ] **Step 3:** Add workspace dep: `npm install @open-effects/shared-types@* -w packages/runtime` (resolves to the local workspace package).
- [ ] **Step 4:** Replace `packages/runtime/package.json` scripts:
  ```json
  "scripts": {
    "studio": "remotion studio src/Root.tsx",
    "build": "remotion bundle src/Root.tsx",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
  ```
- [ ] **Step 5:** Write `remotion.config.ts`:
  ```ts
  import { Config } from "@remotion/cli/config";
  Config.setVideoImageFormat("jpeg");
  Config.setOverwriteOutput(true);
  ```
- [ ] **Step 6:** Write `vitest.config.ts`:
  ```ts
  import { defineConfig } from "vitest/config";
  import path from "node:path";
  export default defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./tests/setup.ts"],
      include: ["tests/**/*.test.{ts,tsx}"]
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") }
    }
  });
  ```
- [ ] **Step 7:** Create `packages/runtime/tests/setup.ts`: `import "@testing-library/jest-dom";`
- [ ] **Step 8:** Commit: `chore(runtime): install remotion + vitest`.

---

### Task 2: Zod easing schema (TDD)

**Files:**
- Create: `packages/shared-types/src/schemas/easing.ts`, `packages/shared-types/tests/schemas.test.ts`
- Modify: `packages/shared-types/package.json` (add `zod` dep)

- [ ] **Step 1:** `npm install zod@3 -w packages/shared-types`
- [ ] **Step 1b:** `npm install -D vitest @vitest/ui -w packages/shared-types`
- [ ] **Step 2:** Write `packages/shared-types/vitest.config.ts` (node env, no jsdom).
- [ ] **Step 3:** Write failing test in `tests/schemas.test.ts`:
  ```ts
  import { describe, it, expect } from "vitest";
  import { EasingSchema } from "@/schemas/easing";
  describe("EasingSchema", () => {
    it("accepts linear", () => {
      expect(EasingSchema.safeParse({ type: "linear" }).success).toBe(true);
    });
    it("accepts cubic-bezier with 4 params", () => {
      expect(EasingSchema.safeParse({ type: "cubic-bezier", params: [0.25, 0.1, 0.25, 1] }).success).toBe(true);
    });
    it("accepts spring with damping/stiffness/mass", () => {
      expect(EasingSchema.safeParse({ type: "spring", params: { damping: 10, stiffness: 100, mass: 1 } }).success).toBe(true);
    });
    it("rejects unknown type", () => {
      expect(EasingSchema.safeParse({ type: "magic" }).success).toBe(false);
    });
    it("rejects cubic-bezier with wrong arity", () => {
      expect(EasingSchema.safeParse({ type: "cubic-bezier", params: [0, 1] }).success).toBe(false);
    });
  });
  ```
- [ ] **Step 4:** Run test, confirm fail (no schema yet).
- [ ] **Step 5:** Implement `schemas/easing.ts`:
  ```ts
  import { z } from "zod";
  export const EasingSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("linear") }),
    z.object({ type: z.literal("ease-in") }),
    z.object({ type: z.literal("ease-out") }),
    z.object({ type: z.literal("ease-in-out") }),
    z.object({ type: z.literal("cubic-bezier"), params: z.tuple([z.number(), z.number(), z.number(), z.number()]) }),
    z.object({ type: z.literal("spring"), params: z.object({
      damping: z.number().positive(),
      stiffness: z.number().positive(),
      mass: z.number().positive()
    }) })
  ]);
  export type Easing = z.infer<typeof EasingSchema>;
  ```
- [ ] **Step 6:** Run test, confirm pass.
- [ ] **Step 7:** Commit: `feat(shared-types): easing schema`.

---

### Task 3: Keyframe + VolumeKeyframe schemas (TDD)

**Files:**
- Create: `packages/shared-types/src/schemas/keyframe.ts`
- Modify: `packages/shared-types/tests/schemas.test.ts`

- [ ] **Step 1:** Add failing tests for `KeyframeSchema` (frame ≥ 0, property string, value string, easingOut Easing) and `VolumeKeyframeSchema` (frame ≥ 0, value 0..1, easingOut Easing).
- [ ] **Step 2:** Implement:
  ```ts
  import { z } from "zod";
  import { EasingSchema } from "./easing";
  export const KeyframeSchema = z.object({
    id: z.string().optional(),
    frame: z.number().int().min(0),
    property: z.string().min(1),
    value: z.string(),
    easingOut: EasingSchema
  });
  export const VolumeKeyframeSchema = z.object({
    id: z.string().optional(),
    frame: z.number().int().min(0),
    value: z.number().min(0).max(1),
    easingOut: EasingSchema
  });
  export type Keyframe = z.infer<typeof KeyframeSchema>;
  export type VolumeKeyframe = z.infer<typeof VolumeKeyframeSchema>;
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(shared-types): keyframe schemas`.

---

### Task 4: Layer schema (TDD)

**Files:**
- Create: `packages/shared-types/src/schemas/layer.ts`
- Modify: `packages/shared-types/tests/schemas.test.ts`

- [ ] **Step 1:** Add failing tests:
  - Valid layer: `{ id, order, name, html, css, startFrame: 0, endFrame: 30, keyframes: [] }`
  - Reject `endFrame < startFrame`
  - Reject empty html (`""` is valid; layer with missing html field invalid)
- [ ] **Step 2:** Implement:
  ```ts
  import { z } from "zod";
  import { KeyframeSchema } from "./keyframe";
  export const LayerSchema = z.object({
    id: z.string(),
    order: z.number().int().min(0),
    name: z.string(),
    html: z.string(),
    css: z.string(),
    startFrame: z.number().int().min(0),
    endFrame: z.number().int().min(0),
    keyframes: z.array(KeyframeSchema).default([])
  }).refine((l) => l.endFrame >= l.startFrame, {
    message: "endFrame must be >= startFrame", path: ["endFrame"]
  });
  export type Layer = z.infer<typeof LayerSchema>;
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(shared-types): layer schema`.

---

### Task 5: Asset + AudioTrack schemas (TDD)

**Files:**
- Create: `packages/shared-types/src/schemas/audio.ts`
- Modify: `packages/shared-types/tests/schemas.test.ts`

- [ ] **Step 1:** Add failing tests for `AssetSchema` (id, type ∈ {image,audio,video,font}, filename, path, mimeType, size>0) and `AudioTrackSchema` (assetId, startFrame≥0, trimStart≥0, trimEnd>trimStart, optional eq, volumeKeyframes default []).
- [ ] **Step 2:** Implement:
  ```ts
  import { z } from "zod";
  import { VolumeKeyframeSchema } from "./keyframe";
  export const AssetTypeSchema = z.enum(["image", "audio", "video", "font"]);
  export const AssetSchema = z.object({
    id: z.string(),
    type: AssetTypeSchema,
    filename: z.string(),
    path: z.string(),
    mimeType: z.string(),
    size: z.number().int().positive(),
    sha256: z.string().optional()
  });
  export const EqSchema = z.object({
    low: z.number(), mid: z.number(), high: z.number(), presence: z.number()
  });
  export const AudioTrackSchema = z.object({
    id: z.string(),
    assetId: z.string(),
    assetPath: z.string(),                 // resolved path for runtime
    startFrame: z.number().int().min(0),
    trimStart: z.number().int().min(0),
    trimEnd: z.number().int().min(0),
    eq: EqSchema.nullable().optional(),
    volumeKeyframes: z.array(VolumeKeyframeSchema).default([])
  }).refine((t) => t.trimEnd > t.trimStart, {
    message: "trimEnd must be > trimStart", path: ["trimEnd"]
  });
  export type Asset = z.infer<typeof AssetSchema>;
  export type AudioTrack = z.infer<typeof AudioTrackSchema>;
  export type Eq = z.infer<typeof EqSchema>;
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(shared-types): audio schemas`.

---

### Task 6: Scene schema (TDD)

**Files:**
- Create: `packages/shared-types/src/schemas/scene.ts`
- Modify: `packages/shared-types/tests/schemas.test.ts`

- [ ] **Step 1:** Add failing tests: valid scene with layers + audio; reject `durationFrames ≤ 0`; transitionIn optional and validates against allowed types `none|fade|slide-left|slide-right|slide-up|slide-down`.
- [ ] **Step 2:** Implement:
  ```ts
  import { z } from "zod";
  import { LayerSchema } from "./layer";
  import { AudioTrackSchema } from "./audio";
  export const TransitionSchema = z.object({
    type: z.enum(["none", "fade", "slide-left", "slide-right", "slide-up", "slide-down"]),
    durationFrames: z.number().int().min(0).default(15)
  });
  export const SceneSchema = z.object({
    id: z.string(),
    order: z.number().int().min(0),
    durationFrames: z.number().int().positive(),
    transitionIn: TransitionSchema.nullable().optional(),
    layers: z.array(LayerSchema).default([]),
    audioTracks: z.array(AudioTrackSchema).default([])
  });
  export type Scene = z.infer<typeof SceneSchema>;
  export type Transition = z.infer<typeof TransitionSchema>;
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(shared-types): scene schema`.

---

### Task 7: Project schema (root) (TDD)

**Files:**
- Create: `packages/shared-types/src/schemas/project.ts`
- Modify: `packages/shared-types/tests/schemas.test.ts`

- [ ] **Step 1:** Add failing tests: valid project with multiple scenes; reject negative width/height; reject fps ∉ {24, 30, 60}.
- [ ] **Step 2:** Implement:
  ```ts
  import { z } from "zod";
  import { SceneSchema } from "./scene";
  export const ProjectSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
    scenes: z.array(SceneSchema).default([])
  });
  export type Project = z.infer<typeof ProjectSchema>;
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(shared-types): project schema`.

---

### Task 8: `shared-types` index re-exports

**Files:**
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1:** Replace placeholder with:
  ```ts
  export * from "./schemas/easing";
  export * from "./schemas/keyframe";
  export * from "./schemas/layer";
  export * from "./schemas/audio";
  export * from "./schemas/scene";
  export * from "./schemas/project";
  ```
- [ ] **Step 2:** From root: `npm run typecheck --workspaces --if-present` → must pass.
- [ ] **Step 3:** Commit: `feat(shared-types): public API barrel`.

---

### Task 9: HTML sanitizer (TDD)

**Files:**
- Create: `packages/runtime/src/lib/sanitizeHtml.ts`, `packages/runtime/tests/sanitizeHtml.test.ts`

- [ ] **Step 1:** Write failing tests:
  ```ts
  import { describe, it, expect } from "vitest";
  import { sanitizeHtml } from "@/lib/sanitizeHtml";
  describe("sanitizeHtml", () => {
    it("removes <script>", () => {
      expect(sanitizeHtml("<div>ok</div><script>alert(1)</script>")).not.toMatch(/script/i);
    });
    it("removes onclick handlers", () => {
      expect(sanitizeHtml('<div onclick="x()">hi</div>')).not.toMatch(/onclick/i);
    });
    it("removes javascript: URLs", () => {
      expect(sanitizeHtml('<a href="javascript:x()">x</a>')).not.toMatch(/javascript:/i);
    });
    it("preserves class, style, data-*", () => {
      const out = sanitizeHtml('<div class="a" style="color:red" data-x="1">x</div>');
      expect(out).toMatch(/class="a"/);
      expect(out).toMatch(/style="color:red"/);
      expect(out).toMatch(/data-x="1"/);
    });
    it("preserves nested structure", () => {
      const out = sanitizeHtml("<div><p>hello <strong>world</strong></p></div>");
      expect(out).toMatch(/<strong>world<\/strong>/);
    });
  });
  ```
- [ ] **Step 2:** Implement `sanitizeHtml.ts`:
  ```ts
  import DOMPurify from "isomorphic-dompurify";
  export function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_ATTR: ["class", "style", "id", "src", "alt", "href", "title", "width", "height"],
      ADD_DATA_URI_TAGS: ["img"],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"]
    });
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(runtime): HTML sanitizer`.

**Note:** `style` tag is forbidden inside HTML — CSS goes through the dedicated `css` field per layer (Task 10).

---

### Task 10: CSS scoping utility (TDD)

**Files:**
- Create: `packages/runtime/src/lib/scopeCss.ts`, `packages/runtime/tests/scopeCss.test.ts`

- [ ] **Step 1:** Write failing tests:
  ```ts
  import { describe, it, expect } from "vitest";
  import { scopeCss } from "@/lib/scopeCss";
  describe("scopeCss", () => {
    it("prefixes simple selectors", () => {
      const out = scopeCss(".card { color: red; }", "[data-layer-id=\"L1\"]");
      expect(out).toContain('[data-layer-id="L1"] .card');
    });
    it("prefixes element selectors", () => {
      const out = scopeCss("p { margin: 0; }", "[data-layer-id=\"L1\"]");
      expect(out).toContain('[data-layer-id="L1"] p');
    });
    it("does not prefix @keyframes", () => {
      const out = scopeCss("@keyframes spin { from { rotate: 0 } to { rotate: 360deg } }", "[data-layer-id=\"L1\"]");
      expect(out).toContain("@keyframes spin");
      expect(out).not.toContain('[data-layer-id="L1"] @keyframes');
    });
    it("returns empty string for empty input", () => {
      expect(scopeCss("", "[data-layer-id=\"L1\"]")).toBe("");
    });
    it("handles invalid CSS gracefully", () => {
      expect(() => scopeCss("not css {{{ ", "[data-layer-id=\"L1\"]")).not.toThrow();
    });
  });
  ```
- [ ] **Step 2:** Implement `scopeCss.ts`:
  ```ts
  import postcss from "postcss";
  import prefixer from "postcss-prefix-selector";

  export function scopeCss(css: string, prefix: string): string {
    if (!css.trim()) return "";
    try {
      const result = postcss([
        prefixer({
          prefix,
          transform(prefix, selector, prefixedSelector) {
            // Avoid prefixing :root and html
            if (selector.startsWith(":root") || selector === "html") return selector;
            return prefixedSelector;
          }
        })
      ]).process(css, { from: undefined });
      return result.css;
    } catch {
      return ""; // fail-safe: return empty rather than crash composition
    }
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(runtime): CSS scoping`.

---

### Task 11: Scene-offset calculator (TDD)

**Files:**
- Create: `packages/runtime/src/lib/offset.ts`, `packages/runtime/tests/offset.test.ts`

- [ ] **Step 1:** Write failing tests:
  ```ts
  import { describe, it, expect } from "vitest";
  import { sceneStartFrame, totalDuration } from "@/lib/offset";
  import type { Project } from "@open-effects/shared-types";

  const fx = (durations: number[]): Project => ({
    id: "p1", name: "p", width: 1920, height: 1080, fps: 30,
    scenes: durations.map((d, i) => ({
      id: `s${i}`, order: i, durationFrames: d, layers: [], audioTracks: []
    }))
  });

  describe("sceneStartFrame", () => {
    it("returns 0 for first scene", () => {
      expect(sceneStartFrame(fx([30, 60]), 0)).toBe(0);
    });
    it("returns sum of preceding durations", () => {
      expect(sceneStartFrame(fx([30, 60, 90]), 2)).toBe(90);
    });
  });

  describe("totalDuration", () => {
    it("sums all scene durations", () => {
      expect(totalDuration(fx([30, 60, 90]))).toBe(180);
    });
    it("returns 0 for empty project", () => {
      expect(totalDuration(fx([]))).toBe(0);
    });
  });
  ```
- [ ] **Step 2:** Implement `offset.ts`:
  ```ts
  import type { Project } from "@open-effects/shared-types";
  export function sceneStartFrame(project: Project, sceneIndex: number): number {
    return project.scenes.slice(0, sceneIndex).reduce((acc, s) => acc + s.durationFrames, 0);
  }
  export function totalDuration(project: Project): number {
    return project.scenes.reduce((acc, s) => acc + s.durationFrames, 0);
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(runtime): offset utils`.

**Note:** transitions don't add to total duration in v1 (they overlap with the previous scene's tail). This will be revisited in Stage 9 — for Stage 2 keep it simple.

---

### Task 12: `Layer` component (TDD with jsdom)

**Files:**
- Create: `packages/runtime/src/components/Layer.tsx`, `packages/runtime/tests/Layer.test.tsx`

- [ ] **Step 1:** Write failing tests:
  ```tsx
  import { describe, it, expect } from "vitest";
  import { render } from "@testing-library/react";
  import { Layer } from "@/components/Layer";
  import type { Layer as LayerT } from "@open-effects/shared-types";

  const baseLayer: LayerT = {
    id: "L1", order: 0, name: "test",
    html: '<div class="card">hello</div>',
    css: ".card { color: red; }",
    startFrame: 0, endFrame: 30, keyframes: []
  };

  describe("<Layer>", () => {
    it("renders sanitized HTML inside isolated container", () => {
      const { container } = render(<Layer layer={baseLayer} />);
      const wrapper = container.querySelector('[data-layer-id="L1"]');
      expect(wrapper).toBeTruthy();
      expect(wrapper!.innerHTML).toContain('<div class="card">hello</div>');
    });
    it("strips <script> from HTML", () => {
      const layer = { ...baseLayer, html: '<div>ok</div><script>alert(1)</script>' };
      const { container } = render(<Layer layer={layer} />);
      expect(container.innerHTML).not.toMatch(/<script/i);
    });
    it("injects scoped CSS prefixed by layer id", () => {
      const { container } = render(<Layer layer={baseLayer} />);
      const style = container.querySelector("style");
      expect(style?.textContent).toContain('[data-layer-id="L1"] .card');
    });
    it("applies contain: strict to wrapper", () => {
      const { container } = render(<Layer layer={baseLayer} />);
      const wrapper = container.querySelector('[data-layer-id="L1"]') as HTMLElement;
      expect(wrapper.style.contain).toBe("strict");
    });
  });
  ```
- [ ] **Step 2:** Implement `components/Layer.tsx`:
  ```tsx
  import React, { useMemo } from "react";
  import type { Layer as LayerT } from "@open-effects/shared-types";
  import { sanitizeHtml } from "../lib/sanitizeHtml";
  import { scopeCss } from "../lib/scopeCss";

  export const Layer: React.FC<{ layer: LayerT }> = ({ layer }) => {
    const cleanHtml = useMemo(() => sanitizeHtml(layer.html), [layer.html]);
    const scopedCss = useMemo(
      () => scopeCss(layer.css, `[data-layer-id="${layer.id}"]`),
      [layer.css, layer.id]
    );
    return (
      <>
        {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
        <div
          data-layer-id={layer.id}
          style={{ position: "absolute", inset: 0, contain: "strict" }}
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      </>
    );
  };
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(runtime): Layer component`.

**Stage 4 hook:** `Layer` will accept computed inline styles from the keyframe interpolator and merge them onto the wrapper `style`. Schema is forward-compatible.

---

### Task 13: `SceneRenderer` and `OpenEffectsComposition` (TDD)

**Files:**
- Create: `packages/runtime/src/components/SceneRenderer.tsx`, `packages/runtime/src/OpenEffectsComposition.tsx`, `packages/runtime/tests/OpenEffectsComposition.test.tsx`

- [ ] **Step 1:** Write failing test:
  ```tsx
  import { describe, it, expect } from "vitest";
  import { render } from "@testing-library/react";
  import { OpenEffectsComposition } from "@/OpenEffectsComposition";
  import { singleSceneFixture } from "@/fixtures/singleScene";
  describe("<OpenEffectsComposition>", () => {
    it("renders all scene wrappers ordered", () => {
      const { container } = render(<OpenEffectsComposition project={singleSceneFixture} />);
      // jsdom env: Sequence renders children unconditionally without frame context
      // We assert the first layer's HTML is in the DOM tree.
      expect(container.innerHTML).toContain("singleScene");
    });
  });
  ```
  (the Sequence wrapper in Remotion outside `<Composition>` may behave differently — for unit tests we render the children directly. See Note below.)
- [ ] **Step 2:** Implement `components/SceneRenderer.tsx`:
  ```tsx
  import React from "react";
  import { AbsoluteFill } from "remotion";
  import type { Scene } from "@open-effects/shared-types";
  import { Layer } from "./Layer";

  export const SceneRenderer: React.FC<{ scene: Scene }> = ({ scene }) => {
    const layers = [...scene.layers].sort((a, b) => a.order - b.order);
    return (
      <AbsoluteFill>
        {layers.map((layer) => (
          <Layer key={layer.id} layer={layer} />
        ))}
      </AbsoluteFill>
    );
  };
  ```
- [ ] **Step 3:** Implement `OpenEffectsComposition.tsx`:
  ```tsx
  import React from "react";
  import { AbsoluteFill, Sequence } from "remotion";
  import type { Project } from "@open-effects/shared-types";
  import { SceneRenderer } from "./components/SceneRenderer";
  import { sceneStartFrame } from "./lib/offset";

  export const OpenEffectsComposition: React.FC<{ project: Project }> = ({ project }) => {
    return (
      <AbsoluteFill style={{ backgroundColor: "transparent" }}>
        {project.scenes.map((scene, i) => (
          <Sequence key={scene.id} from={sceneStartFrame(project, i)} durationInFrames={scene.durationFrames}>
            <SceneRenderer scene={scene} />
          </Sequence>
        ))}
      </AbsoluteFill>
    );
  };
  ```
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit: `feat(runtime): SceneRenderer + OpenEffectsComposition`.

**Note on Sequence in tests:** `Sequence` is a Remotion component that uses internal context. In jsdom unit tests outside a `<Composition>`, it may not gate children by frame, but it does render them. If a test fails because `Sequence` warns about context, mock it via Vitest:
```ts
vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    Sequence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
    useCurrentFrame: () => 0
  };
});
```

---

### Task 14: Fixtures

**Files:**
- Create: `packages/runtime/src/fixtures/singleScene.ts`, `twoScenes.ts`, `unsafeHtml.ts`, `globalCss.ts`

- [ ] **Step 1:** Write `singleScene.ts`:
  ```ts
  import type { Project } from "@open-effects/shared-types";
  export const singleSceneFixture: Project = {
    id: "fx-single", name: "singleScene",
    width: 1920, height: 1080, fps: 30,
    scenes: [{
      id: "s1", order: 0, durationFrames: 90,
      layers: [{
        id: "L1", order: 0, name: "Title",
        html: '<div class="title">singleScene fixture</div>',
        css: '.title { font-size: 96px; color: white; padding: 80px; font-family: sans-serif; }',
        startFrame: 0, endFrame: 90, keyframes: []
      }],
      audioTracks: []
    }]
  };
  ```
- [ ] **Step 2:** Write `twoScenes.ts` with two scenes (60 + 60 frames) each with one layer of distinct content/color.
- [ ] **Step 3:** Write `unsafeHtml.ts` containing `<script>` and `onclick` to verify sanitization in Studio.
- [ ] **Step 4:** Write `globalCss.ts` with a CSS rule like `body { background: red }` — verify it's scoped (page background not affected).
- [ ] **Step 5:** Commit: `feat(runtime): fixtures`.

---

### Task 15: `Root.tsx` for Remotion Studio

**Files:**
- Create: `packages/runtime/src/Root.tsx`

- [ ] **Step 1:** Write `Root.tsx`:
  ```tsx
  import React from "react";
  import { Composition } from "remotion";
  import { OpenEffectsComposition } from "./OpenEffectsComposition";
  import { singleSceneFixture } from "./fixtures/singleScene";
  import { twoScenesFixture } from "./fixtures/twoScenes";
  import { unsafeHtmlFixture } from "./fixtures/unsafeHtml";
  import { globalCssFixture } from "./fixtures/globalCss";
  import { totalDuration } from "./lib/offset";
  import type { Project } from "@open-effects/shared-types";

  const register = (id: string, project: Project) => (
    <Composition
      id={id}
      component={OpenEffectsComposition}
      durationInFrames={totalDuration(project) || 1}
      fps={project.fps}
      width={project.width}
      height={project.height}
      defaultProps={{ project }}
    />
  );

  export const RemotionRoot: React.FC = () => (
    <>
      {register("singleScene", singleSceneFixture)}
      {register("twoScenes", twoScenesFixture)}
      {register("unsafeHtml", unsafeHtmlFixture)}
      {register("globalCss", globalCssFixture)}
    </>
  );
  ```
- [ ] **Step 2:** Update `remotion.config.ts` to point at this if needed (CLI auto-detects).
- [ ] **Step 3:** Commit: `feat(runtime): Studio root with fixtures`.

---

### Task 16: `packages/runtime` index re-exports

**Files:**
- Modify: `packages/runtime/src/index.ts`

- [ ] **Step 1:** Replace placeholder with public API:
  ```ts
  export { OpenEffectsComposition } from "./OpenEffectsComposition";
  export { SceneRenderer } from "./components/SceneRenderer";
  export { Layer } from "./components/Layer";
  export { sceneStartFrame, totalDuration } from "./lib/offset";
  export { sanitizeHtml } from "./lib/sanitizeHtml";
  export { scopeCss } from "./lib/scopeCss";
  ```
- [ ] **Step 2:** From root: `npm run typecheck --workspaces --if-present` → all clean.
- [ ] **Step 3:** Commit: `feat(runtime): public API barrel`.

---

### Task 17: Visual smoke in Remotion Studio

- [ ] **Step 1:** `npm run studio -w packages/runtime` → opens at `http://localhost:3000` (or the port Studio chooses).
- [ ] **Step 2:** Open `singleScene` composition → verify the title appears, white text on transparent canvas.
- [ ] **Step 3:** Open `twoScenes` → scrub timeline, verify scene 1 plays then scene 2 plays.
- [ ] **Step 4:** Open `unsafeHtml` → verify NO `alert(1)` runs (no console activity), `<script>` is stripped.
- [ ] **Step 5:** Open `globalCss` → verify Studio chrome (page background) is NOT red; only the layer is affected.
- [ ] **Step 6:** Modify a fixture's text in the `.ts` file → confirm Studio hot-reloads.

**This is the manual demo for stage closure.**

---

### Task 18: Stage closure verification

- [ ] **Step 1:** From root: `npm test --workspaces --if-present` → all green.
- [ ] **Step 2:** From root: `npm run typecheck --workspaces --if-present` → all green.
- [ ] **Step 3:** Studio smoke checks (Task 17).
- [ ] **Step 4:** Tag closure: `git commit -m "STAGE-2: closed"` (or merge stage branch).

---

## Test summary

| Test | Type | File |
|---|---|---|
| Easing schema (5 cases) | unit | `shared-types/tests/schemas.test.ts` |
| Keyframe + VolumeKeyframe schemas | unit | `shared-types/tests/schemas.test.ts` |
| Layer schema (incl. endFrame≥startFrame) | unit | `shared-types/tests/schemas.test.ts` |
| Asset + AudioTrack schemas | unit | `shared-types/tests/schemas.test.ts` |
| Scene + Transition schemas | unit | `shared-types/tests/schemas.test.ts` |
| Project schema (incl. fps enum) | unit | `shared-types/tests/schemas.test.ts` |
| `sanitizeHtml` (5 cases) | unit | `runtime/tests/sanitizeHtml.test.ts` |
| `scopeCss` (5 cases) | unit | `runtime/tests/scopeCss.test.ts` |
| `sceneStartFrame` + `totalDuration` | unit | `runtime/tests/offset.test.ts` |
| `<Layer>` rendering + isolation (4 cases) | unit (jsdom) | `runtime/tests/Layer.test.tsx` |
| `<OpenEffectsComposition>` smoke | unit (jsdom) | `runtime/tests/OpenEffectsComposition.test.tsx` |
| Studio renders 4 fixtures correctly | manual | `npm run studio -w packages/runtime` |

---

## Risks specific to Stage 2

| Risk | Mitigation |
|---|---|
| `postcss-prefix-selector` API differences across versions | Pin `postcss-prefix-selector` to ^1.16; cover with regression tests in T10. |
| `isomorphic-dompurify` requires jsdom on server-side | Vitest already in jsdom env (T1 step 6); for Remotion's render env (Node + Chromium), verified by package's own polyfill logic. |
| Remotion `Sequence` outside `<Composition>` in Vitest may warn | Mock `remotion` exports in test file (documented in T13). |
| Workspace path resolution for `@open-effects/shared-types` in Vitest | `vitest.config.ts` does NOT need explicit alias if `npm install` linked the workspace correctly; if it fails, add `resolve.alias` for the workspace package. |
| Layer wrapper using `position: absolute; inset: 0` may clip content needing overflow | Acceptable for v1 — layers ARE rectangular regions; if a layer needs to bleed, set its own internal overflow. Documented as constraint. |
| `style` tag forbidden in HTML field is restrictive | Intentional: CSS goes through the dedicated `css` field which is scoped. Documented in editor UX (Stage 3). |

---

## Handoff to Stage 3

Stage 3 will:
- Import `<OpenEffectsComposition>` from `@open-effects/runtime` and feed it via `<Player inputProps={{ project }}>`.
- Build the editor UI (3-panel layout, Monaco for HTML/CSS, Zustand store, autosave).
- Add CRUD endpoints for projects.
- The runtime's contract (props shape, scoped CSS, sanitization) is **frozen** — Stage 3 must not modify runtime internals.
- Hot iteration loop: edit projectJson in Zustand → `<Player>` re-renders.

Future-proofing notes baked in:
- `Layer` accepts a single `layer` prop today. Stage 4 will add a derived `computedStyle` prop (frame-dependent inline styles from keyframes). Schema unchanged.
- `SceneRenderer` has no audio yet. Stage 5 will add `<Audio>` siblings inside the AbsoluteFill.

---

## Final task checklist (execution order)

- [ ] T1 — Install Remotion + Vitest in runtime
- [ ] T2 — Easing schema (TDD)
- [ ] T3 — Keyframe + VolumeKeyframe schemas (TDD)
- [ ] T4 — Layer schema (TDD)
- [ ] T5 — Asset + AudioTrack schemas (TDD)
- [ ] T6 — Scene + Transition schemas (TDD)
- [ ] T7 — Project schema (TDD)
- [ ] T8 — shared-types index barrel
- [ ] T9 — sanitizeHtml (TDD)
- [ ] T10 — scopeCss (TDD)
- [ ] T11 — offset utils (TDD)
- [ ] T12 — `<Layer>` component (TDD)
- [ ] T13 — `<SceneRenderer>` + `<OpenEffectsComposition>` (TDD)
- [ ] T14 — Fixtures (4 files)
- [ ] T15 — `Root.tsx` for Studio
- [ ] T16 — runtime index barrel
- [ ] T17 — Manual Studio smoke (4 fixtures)
- [ ] T18 — Stage closure

**Total tasks:** 18 · **Estimate:** 1.5 weeks · **Critical risks:** scoped CSS edge cases (mitigated by tests in T10) and DOMPurify config strictness (T9 covers the obvious vectors; revisit if a fixture in real use trips on an unexpected sanitization).
