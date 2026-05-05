# Stage 4 — Keyframe Animation Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read `00-master-plan.md`, `01-foundation-stack.md`, `02-runtime-engine.md`, and `03-crud-editor-base.md` first. This stage extends `packages/runtime` with a keyframe interpolator and adds the keyframe authoring UI to the editor. The DB schema is unchanged — `Keyframe` rows already exist (Stage 1) and `KeyframeSchema` is already in `shared-types` (Stage 2).

**Goal:** Make CSS properties on layers animatable. User selects a layer, picks an animatable property, captures a keyframe at the current frame, adds a second keyframe with a different value, picks an easing for the segment between them (including spring), scrubs the timeline, and sees the property animate in `<Player>`.

**Architecture:** A small **property registry** in `packages/runtime` declares the whitelisted animatable properties, their value type (`numeric` / `length-px` / `angle-deg` / `color`), and how they map to CSS (some are sub-properties of `transform` and get composed into a single CSS string). A pure function `computeStylesAtFrame(keyframes, frame, fps)` evaluates all keyframes for a layer at a given frame and returns a `CSSProperties` object. `<Layer>` calls this every frame via `useCurrentFrame()` and merges the result into its wrapper inline style. Easings are: linear, three CSS named easings (implemented as fixed cubic-beziers), arbitrary `cubic-bezier(p1,p2,p3,p4)` (via `bezier-easing`), and `spring(config)` (via Remotion's `spring()` mapped to the segment's `durationInFrames`). The editor adds a **Keyframes** tab to the Inspector and **keyframe dots** to the Timeline, both wired to the existing Zustand store with new actions.

**Tech Stack additions:** `bezier-easing` (cubic-bezier solver), `popmotion` (color mixing only; sub-property animations stay in our compositor) · `remotion::spring` (already available) · existing Zustand + Immer + dnd-kit.

---

## Acceptance criteria → tasks map (Stage 4 master ACs)

| Master AC | Tasks |
|---|---|
| 1. Whitelist of animatable properties | T2 |
| 2. `computeStylesAtFrame` interpolates numeric/color/transform | T3, T4, T7, T8 |
| 3. Easings: linear, ease-in/out, cubic-bezier, spring | T5, T6 |
| 4. Spring uses `durationInFrames = kfB.frame - kfA.frame` | T6, T8 |
| 5. Inspector Keyframes tab (add/delete/edit value/edit easing) | T11, T12 |
| 6. Timeline keyframe dots with drag-to-move-frame | T13 |
| 7. Edit keyframe value + easing from inspector | T11, T12 |
| 8. Preview animates in real time | T9, T14 |
| 9. Keyframes persist (autosave continues to work) | already wired in Stage 3; T10 verifies |

---

## File structure to create

```
packages/runtime/
├── src/
│   ├── keyframes/
│   │   ├── propertyRegistry.ts              # whitelist + type mapping
│   │   ├── parsers.ts                       # parse/serialize per type
│   │   ├── color.ts                         # color parse/serialize/lerp
│   │   ├── easings.ts                       # easing functions
│   │   ├── computeStylesAtFrame.ts          # main interpolator
│   │   ├── composeTransform.ts              # join sub-props into transform string
│   │   └── index.ts                         # barrel
│   └── components/
│       └── Layer.tsx                        # MODIFY: merge computed inline styles
└── tests/
    ├── keyframes/
    │   ├── parsers.test.ts
    │   ├── color.test.ts
    │   ├── easings.test.ts
    │   ├── computeStylesAtFrame.test.ts
    │   └── composeTransform.test.ts

apps/web/
├── src/
│   ├── editor/
│   │   ├── store.ts                         # MODIFY: keyframe actions
│   │   ├── store.types.ts                   # MODIFY
│   │   ├── selectors.ts                     # MODIFY: selectKeyframesByProperty
│   │   └── components/
│   │       ├── inspector/
│   │       │   ├── Inspector.tsx            # MODIFY: add Keyframes tab
│   │       │   ├── KeyframesTab.tsx         # NEW
│   │       │   ├── EasingEditor.tsx         # NEW
│   │       │   └── PropertyPicker.tsx       # NEW
│   │       └── Timeline.tsx                 # MODIFY: render keyframe dots + drag
└── tests/
    └── editor/
        └── store.keyframes.test.ts          # NEW
docs/decisions/
└── 04-color-and-transform-strategy.md       # spike conclusion (T1)
```

---

## Task list (execution order)

### Task 1: Spike — color and compound transform interpolation strategy

**Files:**
- Create: `docs/decisions/04-color-and-transform-strategy.md`

**Goal:** validate the proposed approach before sinking days into implementation.

- [ ] **Step 1:** `npm install popmotion bezier-easing -w packages/runtime`
- [ ] **Step 2:** In a scratch script (`packages/runtime/spike/colorMix.ts`, gitignored or removed after), exercise:
  ```ts
  import { mix } from "popmotion";
  console.log(mix(0, 1, 0.5)); // numeric
  console.log(mix("rgba(255,0,0,1)", "rgba(0,0,255,0)", 0.5)); // color
  console.log(mix("#ff0000", "#0000ff", 0.5)); // hex
  ```
  Verify outputs. Document any limitation.
- [ ] **Step 3:** Confirm the **transform sub-property strategy**: each animatable transform sub-prop (`translateX`, `translateY`, `scale`, `rotate`) is interpolated independently as a primitive (length / number / angle); a small composer joins them into the final `transform` CSS string. Avoids parsing `transform: translate(...) scale(...) rotate(...)` from arbitrary user input. **Constraint:** users animate only via the registered sub-property names — `transform` is not a directly-animatable key.
- [ ] **Step 4:** Write the decision in `docs/decisions/04-color-and-transform-strategy.md`:
  - Color interpolation = `popmotion::mix` (handles rgba, hex, named).
  - Numeric / length-px / angle-deg = manual lerp (1 LOC).
  - Transform sub-properties = independent primitives + composer.
  - Cubic-bezier solver = `bezier-easing`.
  - Spring = Remotion `spring()` with `durationInFrames` = segment length.
- [ ] **Step 5:** Remove the spike script.
- [ ] **Step 6:** Commit: `docs(decisions): color + transform interpolation strategy`.

**Rollback:** if popmotion has hidden issues (e.g., poor handling of named CSS colors mixed with hex), fall back to `colord` library and update the decision doc.

---

### Task 2: Property registry

**Files:**
- Create: `packages/runtime/src/keyframes/propertyRegistry.ts`

- [ ] **Step 1:** Implement:
  ```ts
  export type AnimatableType = "numeric" | "length-px" | "angle-deg" | "color";

  export interface PropertyMeta {
    /** Property key as stored in Keyframe.property */
    key: string;
    /** CSS property this contributes to */
    cssProp: keyof React.CSSProperties | string;
    /** If this is a sub-property of a compound CSS prop (e.g. transform) */
    subProp?: "translateX" | "translateY" | "scale" | "rotate";
    /** Value type for parsing/lerping/serializing */
    type: AnimatableType;
    /** Default serialized value if no keyframe applies */
    defaultValue: string;
    /** Friendly label for UI */
    label: string;
  }

  export const PROPERTIES: Record<string, PropertyMeta> = {
    "opacity":              { key: "opacity",              cssProp: "opacity",          type: "numeric",   defaultValue: "1",   label: "Opacity" },
    "transform.translateX": { key: "transform.translateX", cssProp: "transform", subProp: "translateX", type: "length-px", defaultValue: "0px", label: "Translate X" },
    "transform.translateY": { key: "transform.translateY", cssProp: "transform", subProp: "translateY", type: "length-px", defaultValue: "0px", label: "Translate Y" },
    "transform.scale":      { key: "transform.scale",      cssProp: "transform", subProp: "scale",      type: "numeric",   defaultValue: "1",   label: "Scale" },
    "transform.rotate":     { key: "transform.rotate",     cssProp: "transform", subProp: "rotate",     type: "angle-deg", defaultValue: "0deg", label: "Rotate" },
    "color":                { key: "color",                cssProp: "color",            type: "color",     defaultValue: "rgba(255,255,255,1)", label: "Color" },
    "background-color":     { key: "background-color",     cssProp: "backgroundColor",  type: "color",     defaultValue: "rgba(0,0,0,0)",       label: "Background color" },
    "border-radius":        { key: "border-radius",        cssProp: "borderRadius",     type: "length-px", defaultValue: "0px", label: "Border radius" },
    "width":                { key: "width",                cssProp: "width",            type: "length-px", defaultValue: "auto", label: "Width" },
    "height":               { key: "height",               cssProp: "height",           type: "length-px", defaultValue: "auto", label: "Height" },
    "top":                  { key: "top",                  cssProp: "top",              type: "length-px", defaultValue: "0px", label: "Top" },
    "left":                 { key: "left",                 cssProp: "left",             type: "length-px", defaultValue: "0px", label: "Left" }
  };

  export const ANIMATABLE_KEYS = Object.keys(PROPERTIES);
  ```
- [ ] **Step 2:** Commit: `feat(runtime): property registry`.

---

### Task 3: Numeric / length / angle parsers (TDD)

**Files:**
- Create: `packages/runtime/src/keyframes/parsers.ts`, `packages/runtime/tests/keyframes/parsers.test.ts`

- [ ] **Step 1:** Failing tests:
  ```ts
  import { describe, it, expect } from "vitest";
  import { parseNumeric, parseLengthPx, parseAngleDeg, serializeNumeric, serializeLengthPx, serializeAngleDeg, lerp } from "@/keyframes/parsers";

  describe("parsers", () => {
    it("parseNumeric handles ints + floats", () => {
      expect(parseNumeric("1")).toBe(1);
      expect(parseNumeric("0.5")).toBe(0.5);
      expect(parseNumeric("-2.5")).toBe(-2.5);
    });
    it("parseLengthPx strips px suffix", () => {
      expect(parseLengthPx("100px")).toBe(100);
      expect(parseLengthPx("0px")).toBe(0);
    });
    it("parseLengthPx handles bare numbers", () => {
      expect(parseLengthPx("50")).toBe(50);
    });
    it("parseAngleDeg strips deg suffix", () => {
      expect(parseAngleDeg("180deg")).toBe(180);
    });
    it("serializers round-trip", () => {
      expect(serializeNumeric(1.5)).toBe("1.5");
      expect(serializeLengthPx(100)).toBe("100px");
      expect(serializeAngleDeg(45)).toBe("45deg");
    });
    it("lerp is correct at endpoints and midpoint", () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(0, 10, 0.5)).toBe(5);
    });
  });
  ```
- [ ] **Step 2:** Implement:
  ```ts
  export const parseNumeric = (v: string) => Number(v);
  export const parseLengthPx = (v: string) => Number(v.replace(/px$/, ""));
  export const parseAngleDeg = (v: string) => Number(v.replace(/deg$/, ""));
  export const serializeNumeric = (n: number) => String(n);
  export const serializeLengthPx = (n: number) => `${n}px`;
  export const serializeAngleDeg = (n: number) => `${n}deg`;
  export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(runtime): primitive parsers`.

---

### Task 4: Color interpolation (TDD)

**Files:**
- Create: `packages/runtime/src/keyframes/color.ts`, `packages/runtime/tests/keyframes/color.test.ts`

- [ ] **Step 1:** Failing tests:
  ```ts
  import { describe, it, expect } from "vitest";
  import { mixColor } from "@/keyframes/color";
  describe("mixColor", () => {
    it("returns the start color at t=0", () => {
      expect(mixColor("rgba(255,0,0,1)", "rgba(0,0,255,1)", 0)).toMatch(/255.*0.*0/);
    });
    it("returns the end color at t=1", () => {
      expect(mixColor("rgba(255,0,0,1)", "rgba(0,0,255,1)", 1)).toMatch(/0.*0.*255/);
    });
    it("midpoint mixes channels", () => {
      const out = mixColor("rgba(255,0,0,1)", "rgba(0,0,255,1)", 0.5);
      // popmotion outputs rgba(...) — accept any reasonable midpoint
      expect(out).toMatch(/rgba/);
    });
    it("works with hex inputs", () => {
      const out = mixColor("#ff0000", "#0000ff", 0.5);
      expect(out).toMatch(/rgba/);
    });
  });
  ```
- [ ] **Step 2:** Implement:
  ```ts
  import { mix } from "popmotion";
  export function mixColor(from: string, to: string, t: number): string {
    return mix(from, to, t);
  }
  ```
  (popmotion returns the interpolated color string already in `rgba(...)` form for color inputs.)
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(runtime): color mixing via popmotion`.

---

### Task 5: Easing functions (TDD)

**Files:**
- Create: `packages/runtime/src/keyframes/easings.ts`, `packages/runtime/tests/keyframes/easings.test.ts`

- [ ] **Step 1:** Failing tests:
  ```ts
  import { describe, it, expect } from "vitest";
  import { evalEasing } from "@/keyframes/easings";
  import type { Easing } from "@open-effects/shared-types";
  const fps = 30;

  describe("evalEasing", () => {
    it("linear at endpoints", () => {
      const e: Easing = { type: "linear" };
      expect(evalEasing(e, 0, 30, fps)).toBe(0);
      expect(evalEasing(e, 30, 30, fps)).toBe(1);
    });
    it("linear midpoint", () => {
      expect(evalEasing({ type: "linear" }, 15, 30, fps)).toBeCloseTo(0.5, 5);
    });
    it("cubic-bezier ease-out approximation", () => {
      const e: Easing = { type: "cubic-bezier", params: [0, 0, 0.58, 1] };
      const v = evalEasing(e, 15, 30, fps);
      expect(v).toBeGreaterThan(0.5); // ease-out: more progress at midpoint
    });
    it("ease-in: less progress at midpoint", () => {
      const v = evalEasing({ type: "ease-in" }, 15, 30, fps);
      expect(v).toBeLessThan(0.5);
    });
    it("spring at frame 0 = 0", () => {
      const e: Easing = { type: "spring", params: { damping: 12, stiffness: 100, mass: 1 } };
      expect(evalEasing(e, 0, 30, fps)).toBeCloseTo(0, 5);
    });
    it("spring approaches 1 by end of segment", () => {
      const e: Easing = { type: "spring", params: { damping: 12, stiffness: 100, mass: 1 } };
      const v = evalEasing(e, 30, 30, fps);
      expect(v).toBeGreaterThan(0.95); // approximately settled
    });
    it("guards against zero-length segment", () => {
      expect(evalEasing({ type: "linear" }, 0, 0, fps)).toBe(1);
    });
  });
  ```
- [ ] **Step 2:** Implement:
  ```ts
  import BezierEasing from "bezier-easing";
  import { spring } from "remotion";
  import type { Easing } from "@open-effects/shared-types";

  const easeIn = BezierEasing(0.42, 0, 1, 1);
  const easeOut = BezierEasing(0, 0, 0.58, 1);
  const easeInOut = BezierEasing(0.42, 0, 0.58, 1);

  export function evalEasing(e: Easing, frameInSegment: number, segmentDuration: number, fps: number): number {
    if (segmentDuration <= 0) return 1;
    const t = Math.min(1, Math.max(0, frameInSegment / segmentDuration));
    switch (e.type) {
      case "linear": return t;
      case "ease-in": return easeIn(t);
      case "ease-out": return easeOut(t);
      case "ease-in-out": return easeInOut(t);
      case "cubic-bezier": {
        const [p1, p2, p3, p4] = e.params;
        return BezierEasing(p1, p2, p3, p4)(t);
      }
      case "spring": {
        return spring({
          frame: frameInSegment,
          fps,
          config: e.params,
          durationInFrames: segmentDuration
        });
      }
    }
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(runtime): easings`.

**Note:** `BezierEasing` instances are stateless — caching them per-easing param tuple is a future optimization if profiling shows cost. For v1, instantiate per call (microsecond cost).

---

### Task 6: Transform composer (TDD)

**Files:**
- Create: `packages/runtime/src/keyframes/composeTransform.ts`, `packages/runtime/tests/keyframes/composeTransform.test.ts`

- [ ] **Step 1:** Failing tests:
  ```ts
  import { describe, it, expect } from "vitest";
  import { composeTransform } from "@/keyframes/composeTransform";
  describe("composeTransform", () => {
    it("returns empty string when no parts", () => {
      expect(composeTransform({})).toBe("");
    });
    it("composes translate when only one axis is set", () => {
      expect(composeTransform({ translateX: "100px" })).toBe("translate(100px, 0px)");
    });
    it("composes both translates", () => {
      expect(composeTransform({ translateX: "100px", translateY: "50px" })).toBe("translate(100px, 50px)");
    });
    it("appends scale and rotate in deterministic order", () => {
      expect(composeTransform({ translateX: "10px", scale: "1.5", rotate: "45deg" }))
        .toBe("translate(10px, 0px) scale(1.5) rotate(45deg)");
    });
  });
  ```
- [ ] **Step 2:** Implement:
  ```ts
  type TransformParts = Partial<Record<"translateX" | "translateY" | "scale" | "rotate", string>>;
  export function composeTransform(parts: TransformParts): string {
    const segs: string[] = [];
    if (parts.translateX !== undefined || parts.translateY !== undefined) {
      segs.push(`translate(${parts.translateX ?? "0px"}, ${parts.translateY ?? "0px"})`);
    }
    if (parts.scale !== undefined) segs.push(`scale(${parts.scale})`);
    if (parts.rotate !== undefined) segs.push(`rotate(${parts.rotate})`);
    return segs.join(" ");
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(runtime): transform composer`.

---

### Task 7: `computeStylesAtFrame` (TDD)

**Files:**
- Create: `packages/runtime/src/keyframes/computeStylesAtFrame.ts`, `packages/runtime/tests/keyframes/computeStylesAtFrame.test.ts`

- [ ] **Step 1:** Failing tests:
  ```ts
  import { describe, it, expect } from "vitest";
  import { computeStylesAtFrame } from "@/keyframes/computeStylesAtFrame";
  import type { Keyframe } from "@open-effects/shared-types";

  const linear = { type: "linear" as const };

  describe("computeStylesAtFrame", () => {
    it("returns empty object when no keyframes", () => {
      expect(computeStylesAtFrame([], 0, 30)).toEqual({});
    });
    it("opacity 0→1 linear at midpoint = 0.5", () => {
      const kfs: Keyframe[] = [
        { frame: 0, property: "opacity", value: "0", easingOut: linear },
        { frame: 30, property: "opacity", value: "1", easingOut: linear }
      ];
      const styles = computeStylesAtFrame(kfs, 15, 30);
      expect(Number(styles.opacity)).toBeCloseTo(0.5, 5);
    });
    it("clamps before first keyframe", () => {
      const kfs: Keyframe[] = [
        { frame: 10, property: "opacity", value: "0.5", easingOut: linear },
        { frame: 30, property: "opacity", value: "1", easingOut: linear }
      ];
      const styles = computeStylesAtFrame(kfs, 0, 30);
      expect(Number(styles.opacity)).toBe(0.5);
    });
    it("clamps after last keyframe", () => {
      const kfs: Keyframe[] = [
        { frame: 0, property: "opacity", value: "0", easingOut: linear },
        { frame: 30, property: "opacity", value: "1", easingOut: linear }
      ];
      const styles = computeStylesAtFrame(kfs, 60, 30);
      expect(Number(styles.opacity)).toBe(1);
    });
    it("composes multi-property transform", () => {
      const kfs: Keyframe[] = [
        { frame: 0, property: "transform.translateX", value: "0px", easingOut: linear },
        { frame: 30, property: "transform.translateX", value: "100px", easingOut: linear },
        { frame: 0, property: "transform.scale", value: "1", easingOut: linear },
        { frame: 30, property: "transform.scale", value: "2", easingOut: linear }
      ];
      const styles = computeStylesAtFrame(kfs, 15, 30);
      expect(styles.transform).toContain("translate(50px, 0px)");
      expect(styles.transform).toContain("scale(1.5)");
    });
    it("interpolates color via popmotion", () => {
      const kfs: Keyframe[] = [
        { frame: 0, property: "background-color", value: "rgba(255,0,0,1)", easingOut: linear },
        { frame: 30, property: "background-color", value: "rgba(0,0,255,1)", easingOut: linear }
      ];
      const styles = computeStylesAtFrame(kfs, 15, 30);
      expect(styles.backgroundColor).toMatch(/rgba/);
    });
    it("supports spring easing between two keyframes", () => {
      const kfs: Keyframe[] = [
        { frame: 0, property: "opacity", value: "0", easingOut: { type: "spring", params: { damping: 12, stiffness: 100, mass: 1 } } },
        { frame: 30, property: "opacity", value: "1", easingOut: linear }
      ];
      const at15 = Number(computeStylesAtFrame(kfs, 15, 30).opacity);
      // spring is non-linear; at midpoint should NOT be 0.5
      expect(at15).not.toBeCloseTo(0.5, 1);
    });
  });
  ```
- [ ] **Step 2:** Implement:
  ```ts
  import type { CSSProperties } from "react";
  import type { Keyframe } from "@open-effects/shared-types";
  import { PROPERTIES } from "./propertyRegistry";
  import { evalEasing } from "./easings";
  import { parseNumeric, parseLengthPx, parseAngleDeg, serializeNumeric, serializeLengthPx, serializeAngleDeg, lerp } from "./parsers";
  import { mixColor } from "./color";
  import { composeTransform } from "./composeTransform";

  function interpolatePrimitive(type: "numeric" | "length-px" | "angle-deg" | "color", a: string, b: string, t: number): string {
    switch (type) {
      case "numeric":   return serializeNumeric(lerp(parseNumeric(a), parseNumeric(b), t));
      case "length-px": return serializeLengthPx(lerp(parseLengthPx(a), parseLengthPx(b), t));
      case "angle-deg": return serializeAngleDeg(lerp(parseAngleDeg(a), parseAngleDeg(b), t));
      case "color":     return mixColor(a, b, t);
    }
  }

  export function computeStylesAtFrame(keyframes: Keyframe[], frame: number, fps: number): CSSProperties {
    if (keyframes.length === 0) return {};
    // bucket by property
    const byProp = new Map<string, Keyframe[]>();
    for (const kf of keyframes) {
      if (!byProp.has(kf.property)) byProp.set(kf.property, []);
      byProp.get(kf.property)!.push(kf);
    }
    const transformParts: Record<string, string> = {};
    const styles: Record<string, string> = {};
    for (const [propKey, kfs] of byProp) {
      const meta = PROPERTIES[propKey];
      if (!meta) continue;
      const sorted = [...kfs].sort((a, b) => a.frame - b.frame);
      let value: string;
      if (frame <= sorted[0].frame) {
        value = sorted[0].value;
      } else if (frame >= sorted[sorted.length - 1].frame) {
        value = sorted[sorted.length - 1].value;
      } else {
        const idx = sorted.findIndex((k) => k.frame > frame);
        const a = sorted[idx - 1];
        const b = sorted[idx];
        const t = evalEasing(a.easingOut, frame - a.frame, b.frame - a.frame, fps);
        value = interpolatePrimitive(meta.type, a.value, b.value, t);
      }
      if (meta.subProp) {
        transformParts[meta.subProp] = value;
      } else {
        styles[meta.cssProp as string] = value;
      }
    }
    if (Object.keys(transformParts).length > 0) {
      styles.transform = composeTransform(transformParts);
    }
    return styles as CSSProperties;
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(runtime): computeStylesAtFrame`.

---

### Task 8: Wire computed styles into `<Layer>`

**Files:**
- Modify: `packages/runtime/src/components/Layer.tsx`
- Modify: `packages/runtime/tests/Layer.test.tsx` (add test)

- [ ] **Step 1:** Add failing test:
  ```tsx
  it("merges computed inline style from keyframes", () => {
    const layer: LayerT = {
      ...baseLayer,
      keyframes: [
        { frame: 0, property: "opacity", value: "0", easingOut: { type: "linear" } },
        { frame: 30, property: "opacity", value: "1", easingOut: { type: "linear" } }
      ]
    };
    // Mock useCurrentFrame in remotion to return 15
    vi.mock("remotion", async (orig) => {
      const actual = await orig<typeof import("remotion")>();
      return { ...actual, useCurrentFrame: () => 15, useVideoConfig: () => ({ fps: 30, durationInFrames: 30, width: 1920, height: 1080 }) };
    });
    const { container } = render(<Layer layer={layer} />);
    const wrapper = container.querySelector('[data-layer-id="L1"]') as HTMLElement;
    expect(parseFloat(wrapper.style.opacity)).toBeCloseTo(0.5, 1);
  });
  ```
- [ ] **Step 2:** Modify `Layer.tsx`:
  ```tsx
  import { useCurrentFrame, useVideoConfig } from "remotion";
  import { computeStylesAtFrame } from "../keyframes/computeStylesAtFrame";

  export const Layer: React.FC<{ layer: LayerT }> = ({ layer }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const cleanHtml = useMemo(() => sanitizeHtml(layer.html), [layer.html]);
    const scopedCss = useMemo(
      () => scopeCss(layer.css, `[data-layer-id="${layer.id}"]`),
      [layer.css, layer.id]
    );
    // Compute frame-dependent inline styles
    const localFrame = frame - layer.startFrame;
    const animatedStyle = useMemo(
      () => computeStylesAtFrame(layer.keyframes, localFrame, fps),
      [layer.keyframes, localFrame, fps]
    );
    return (
      <>
        {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
        <div
          data-layer-id={layer.id}
          style={{ position: "absolute", inset: 0, contain: "strict", ...animatedStyle }}
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      </>
    );
  };
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Update `packages/runtime/src/index.ts` barrel to export `computeStylesAtFrame`, `PROPERTIES`, `ANIMATABLE_KEYS`.
- [ ] **Step 5:** Commit: `feat(runtime): Layer applies keyframe-computed styles`.

**Memoization note:** `useMemo` deps include `localFrame`, which changes every frame. The cost is one `computeStylesAtFrame` call per layer per frame — acceptable given the documented target of ≤30 layers/scene × ≤50 keyframes/layer.

---

### Task 9: Store actions for keyframes (TDD)

**Files:**
- Modify: `apps/web/src/editor/store.ts`, `store.types.ts`
- Create: `apps/web/tests/editor/store.keyframes.test.ts`

- [ ] **Step 1:** Add to `EditorActions`:
  ```ts
  addKeyframe: (layerId: string, property: string, frame: number, value: string, easingOut?: Easing) => void;
  deleteKeyframe: (layerId: string, property: string, frame: number) => void;
  moveKeyframe: (layerId: string, property: string, fromFrame: number, toFrame: number) => void;
  updateKeyframeValue: (layerId: string, property: string, frame: number, value: string) => void;
  updateKeyframeEasing: (layerId: string, property: string, frame: number, easingOut: Easing) => void;
  ```
- [ ] **Step 2:** Failing tests:
  - `addKeyframe` appends with default easing `{ type: "linear" }` if not provided.
  - `addKeyframe` rejects unknown properties (throws or no-ops with `console.warn`).
  - `addKeyframe` replaces the value if a keyframe at the same `(layerId, property, frame)` already exists.
  - `deleteKeyframe` removes the matching keyframe.
  - `moveKeyframe` updates `frame`; rejects if target frame is occupied for same `(layerId, property)`.
  - `updateKeyframeValue` mutates only the matching keyframe.
  - `updateKeyframeEasing` mutates `easingOut`.
- [ ] **Step 3:** Implement using same `mutateLayer` helper from Stage 3:
  ```ts
  import { ANIMATABLE_KEYS } from "@open-effects/runtime";
  import { newId } from "@/lib/ids";

  // inside store create():
  addKeyframe: (layerId, property, frame, value, easingOut) => set((s) => {
    if (!ANIMATABLE_KEYS.includes(property)) {
      console.warn(`Unknown animatable property: ${property}`); return;
    }
    mutateLayer(s, layerId, (l) => {
      const existing = l.keyframes.find((k: any) => k.property === property && k.frame === frame);
      if (existing) { existing.value = value; if (easingOut) existing.easingOut = easingOut; return; }
      l.keyframes.push({ id: newId(), frame, property, value, easingOut: easingOut ?? { type: "linear" } });
    });
  }),
  deleteKeyframe: (layerId, property, frame) => set((s) => {
    mutateLayer(s, layerId, (l) => {
      l.keyframes = l.keyframes.filter((k: any) => !(k.property === property && k.frame === frame));
    });
  }),
  moveKeyframe: (layerId, property, fromFrame, toFrame) => set((s) => {
    mutateLayer(s, layerId, (l) => {
      const collision = l.keyframes.find((k: any) => k.property === property && k.frame === toFrame);
      if (collision) return;
      const kf = l.keyframes.find((k: any) => k.property === property && k.frame === fromFrame);
      if (kf) kf.frame = toFrame;
    });
  }),
  updateKeyframeValue: (layerId, property, frame, value) => set((s) => {
    mutateLayer(s, layerId, (l) => {
      const kf = l.keyframes.find((k: any) => k.property === property && k.frame === frame);
      if (kf) kf.value = value;
    });
  }),
  updateKeyframeEasing: (layerId, property, frame, easingOut) => set((s) => {
    mutateLayer(s, layerId, (l) => {
      const kf = l.keyframes.find((k: any) => k.property === property && k.frame === frame);
      if (kf) kf.easingOut = easingOut;
    });
  })
  ```
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit: `feat(editor): keyframe store actions`.

---

### Task 10: Selectors for keyframes

**Files:**
- Modify: `apps/web/src/editor/selectors.ts`, `tests/editor/selectors.test.ts`

- [ ] **Step 1:** Failing test for `selectAnimatedProperties(state)` — returns the unique list of properties currently animated on the active layer.
- [ ] **Step 2:** Implement:
  ```ts
  export const selectAnimatedProperties = (s: EditorState): string[] => {
    const l = selectActiveLayer(s);
    if (!l) return [];
    return Array.from(new Set(l.keyframes.map((k) => k.property))).sort();
  };
  export const selectKeyframesForProperty = (property: string) => (s: EditorState) => {
    const l = selectActiveLayer(s);
    if (!l) return [];
    return l.keyframes
      .filter((k) => k.property === property)
      .sort((a, b) => a.frame - b.frame);
  };
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(editor): keyframe selectors`.

---

### Task 11: PropertyPicker + KeyframesTab UI

**Files:**
- Create: `apps/web/src/editor/components/inspector/PropertyPicker.tsx`, `KeyframesTab.tsx`
- Modify: `Inspector.tsx` (add tab)

- [ ] **Step 1:** `PropertyPicker.tsx`: shadcn `Select` listing entries from `PROPERTIES` (label + key). Selected value emits via `onChange(propertyKey)`.
- [ ] **Step 2:** `KeyframesTab.tsx`:
  - Header: PropertyPicker + "+ Add keyframe" button (disabled if no property selected).
    - Click adds a keyframe at `currentFrame` using the property's `defaultValue` for the very first keyframe of that property, OR using the value already animated at `currentFrame` (sample current state) for subsequent keyframes.
  - Body: list of currently animated properties, each expandable to show its keyframes (frame, value input, easing summary, delete button).
  - Each keyframe row has:
    - Frame number (numeric input → `moveKeyframe` if changed; checks collision via store action)
    - Value input (text input bound to `updateKeyframeValue`); for `color` type, render shadcn color picker (or fallback `<input type="color">`); for `numeric`/`length-px`/`angle-deg`, numeric input + suffix
    - Easing button → opens `EasingEditor` popover (Task 12)
    - Delete button (calls `deleteKeyframe`)
- [ ] **Step 3:** Add the tab to `Inspector.tsx`'s shadcn `Tabs` (4th tab "Keyframes" alongside Props/HTML/CSS).
- [ ] **Step 4:** Manual: select a layer, choose `opacity`, click "+ Add keyframe", see keyframe at frame 0 with value `1`. Move scrubber to frame 30, change value to `0.2`, see preview animate.
- [ ] **Step 5:** Commit: `feat(editor): keyframes tab UI`.

---

### Task 12: EasingEditor (popover)

**Files:**
- Create: `apps/web/src/editor/components/inspector/EasingEditor.tsx`

- [ ] **Step 1:** Implement as a shadcn `Popover` with:
  - Type select: `linear`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier`, `spring`
  - For `cubic-bezier`: 4 numeric inputs (defaults `[0.25, 0.1, 0.25, 1]`)
  - For `spring`: 3 numeric inputs (`damping`, `stiffness`, `mass`; defaults `12 / 100 / 1`)
  - Live preview: a tiny SVG curve rendering 100 sampled points of the selected easing (call `evalEasing(e, t * 30, 30, 30)` for `t` in 0..1) — gives the user immediate visual feedback.
  - "Save" button calls `updateKeyframeEasing(layerId, property, frame, easing)`.
- [ ] **Step 2:** Manual: change a keyframe's easing to spring and confirm preview behavior reflects bounce.
- [ ] **Step 3:** Commit: `feat(editor): easing editor with curve preview`.

---

### Task 13: Timeline keyframe dots + drag-to-move-frame

**Files:**
- Modify: `apps/web/src/editor/components/Timeline.tsx`

- [ ] **Step 1:** Augment Timeline to render, for the active layer (when one is selected), a horizontal lane PER animated property below the scene strip. Each keyframe is a circular dot positioned at `(frame / totalFrames) * timelineWidth`.
- [ ] **Step 2:** Make dots draggable (vanilla pointer events; dnd-kit is not necessary here — single-axis drag with snap-to-frame). On drop, compute target frame and call `moveKeyframe`. If collision, no-op (visually snap back).
- [ ] **Step 3:** Click a dot → also selects that keyframe in the Inspector (optional polish; OK to skip in v1).
- [ ] **Step 4:** Manual: drag a keyframe dot → frame number updates in inspector AND the Player's animation reflects the new timing.
- [ ] **Step 5:** Commit: `feat(editor): keyframe dots in timeline with drag`.

---

### Task 14: Subscribe Player frame → store

**Files:**
- Modify: `apps/web/src/editor/components/PreviewPane.tsx`

- [ ] **Step 1:** Capture `playerRef`. Subscribe to its `frameupdate` event:
  ```tsx
  const ref = useRef<PlayerRef>(null);
  useEffect(() => {
    const p = ref.current; if (!p) return;
    const onFrame = ({ detail }: any) => setCurrentFrame(detail.frame);
    p.addEventListener("frameupdate", onFrame as any);
    return () => p.removeEventListener("frameupdate", onFrame as any);
  }, [setCurrentFrame]);
  ```
- [ ] **Step 2:** Also propagate store → player when scrubbing programmatically (e.g., when timeline is clicked): `playerRef.current?.seekTo(frame)`.
- [ ] **Step 3:** Manual: scrub Player → Inspector "current frame" indicator updates → Timeline cursor moves; conversely, click a position in Timeline → Player seeks.
- [ ] **Step 4:** Commit: `feat(editor): bidirectional frame sync`.

---

### Task 15: End-to-end smoke + closure

- [ ] **Step 1:** `npm test --workspaces --if-present` → all green (new color, easing, computeStylesAtFrame, transform composer, store keyframes tests).
- [ ] **Step 2:** `npm run typecheck --workspaces --if-present` → clean.
- [ ] **Step 3:** Manual smoke:
  1. Create project 1920×1080 30fps.
  2. Add layer with HTML `<div class="box">box</div>` and CSS `.box { width:200px; height:200px; background:red; }`.
  3. Add `opacity` keyframes 0→1 at frames 0, 30 with `spring` easing.
  4. Add `transform.translateX` keyframes 0→500px at frames 0, 60 with `ease-out`.
  5. Add `background-color` keyframes `rgba(255,0,0,1)` → `rgba(0,0,255,1)` at frames 0, 60 linear.
  6. Play preview → confirm: box fades in with bounce, slides right with deceleration, color shifts red→blue.
  7. Reload page — animation persists exactly.
- [ ] **Step 4:** Tag closure: `git commit -m "STAGE-4: closed"`.

---

## Test summary

| Test | Type | File |
|---|---|---|
| primitive parsers + lerp | unit | `runtime/tests/keyframes/parsers.test.ts` |
| color mix endpoints + midpoint | unit | `runtime/tests/keyframes/color.test.ts` |
| easings (7 cases) | unit | `runtime/tests/keyframes/easings.test.ts` |
| transform composer | unit | `runtime/tests/keyframes/composeTransform.test.ts` |
| computeStylesAtFrame (7 cases) | unit | `runtime/tests/keyframes/computeStylesAtFrame.test.ts` |
| `<Layer>` applies computed inline style | unit (jsdom) | `runtime/tests/Layer.test.tsx` |
| store keyframe actions (7 cases) | unit | `web/tests/editor/store.keyframes.test.ts` |
| End-to-end animation smoke | manual | browser |

---

## Risks specific to Stage 4

| Risk | Mitigation |
|---|---|
| popmotion's `mix()` returns formats that React style won't accept | The output is `rgba(...)` which React accepts as a string for `color`/`backgroundColor`. Verified in spike (T1). |
| Scrubbing performance with many animated properties | `useMemo` per layer with `[keyframes, localFrame, fps]` deps — recomputes only when `localFrame` changes. Profile in T15 stress scenario. If issues: precompute keyframe segments per layer when `keyframes` change (one-time work) and at frame-time only do segment lookup + interpolate. |
| `bezier-easing` instantiation overhead per call | Acceptable for v1 (microsecond cost). Future opt: cache by params tuple via `useMemo`. |
| Spring tail can overshoot endpoint values causing visible glitches | Documented behavior: spring is mapped to the segment's `durationInFrames` and naturally settles by the segment end. If a user picks an aggressive config that doesn't settle, they see overshoot — that's by design. Easing curve preview (T12) gives them feedback. |
| Color keyframes between hex and rgba | popmotion handles this transparently (verified in T4 + spike). |
| Width/height/top/left as `length-px` only — users may want `%` or `auto` | Documented constraint for v1. `length-px` only. The whitelist is intentionally narrow; expanding it is a v2 effort. |
| Timeline dots cluster when scenes are long and frame range is dense | Acceptable for v1. Stage 9 may add a zoom level on the Timeline if observed in QA. |

---

## Handoff to Stage 5

Stage 5 (`05-audio-basic.md`) will:
- Add Asset upload endpoint and sidebar.
- Add `AudioTrack` rendering inside `SceneRenderer` (sibling of layers, using `<Audio>` from `@remotion/media`).
- Extend the Timeline to show audio strips with waveforms.
- Stage 4 contracts that Stage 5 must respect:
  - Property registry stays — audio uses its own track schema, separate from layer keyframes.
  - `computeStylesAtFrame` is layer-only; volume keyframes get their own evaluator in Stage 6 with the same easing logic (reuse `evalEasing`).
  - Timeline's lane structure already supports horizontal strips per layer; audio strips slot in naturally beside scene strip.

---

## Final task checklist (execution order)

- [ ] T1 — Spike + decision doc
- [ ] T2 — Property registry
- [ ] T3 — Primitive parsers (TDD)
- [ ] T4 — Color mix (TDD)
- [ ] T5 — Easing functions (TDD)
- [ ] T6 — Transform composer (TDD)
- [ ] T7 — computeStylesAtFrame (TDD)
- [ ] T8 — Layer wires computed styles (TDD)
- [ ] T9 — Store keyframe actions (TDD)
- [ ] T10 — Keyframe selectors
- [ ] T11 — PropertyPicker + KeyframesTab UI
- [ ] T12 — EasingEditor popover
- [ ] T13 — Timeline keyframe dots + drag
- [ ] T14 — Player frame ↔ store sync
- [ ] T15 — End-to-end smoke + closure

**Total tasks:** 15 · **Estimate:** 2.5 weeks · **Critical risks:** color/transform interpolation (mitigated by spike T1), spring overshoot UX (mitigated by easing preview T12).
