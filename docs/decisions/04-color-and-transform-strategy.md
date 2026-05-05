# Decision: Color and Transform Interpolation Strategy (Stage 4)

**Date:** 2026-05-05
**Status:** Accepted

## Context

Stage 4 adds keyframe animation to the runtime. Before implementing, a spike
validated the approach for color interpolation and compound transform handling.

## Decisions

### 1. Color interpolation — `popmotion::mixColor`

Use `mixColor` from `popmotion` (v11) to blend color values.

**API note (spike finding):** In popmotion v11, `mixColor(from, to)` is a
higher-order function that returns a mixer: `(t: number) => string`. The plain
`mix(from, to, t)` is a numeric-only lerp and does NOT handle color strings.
The plan's sample used `mix` for colors — that is wrong; `mixColor` must be
used instead.

**Spike outputs** (run via `npx tsx packages/runtime/spike/colorMix.ts`):

```
mix(0, 1, 0.5)                                          → 0.5
mixColor("rgba(255,0,0,1)", "rgba(0,0,255,0)")(0.5)     → rgba(180, 0, 180, 0.5)
mixColor("#ff0000", "#0000ff")(0.5)                     → rgba(180, 0, 180, 1)
```

Observations:
- Numeric lerp works correctly.
- `mixColor` handles `rgba(...)` inputs including alpha channel interpolation.
- `mixColor` handles hex inputs and returns `rgba(...)` — valid for React inline styles.
- Mixing hex (fully opaque) preserves alpha = 1 as expected.

Implementation:

```ts
import { mixColor } from "popmotion";

export function mixColorValue(from: string, to: string, t: number): string {
  return mixColor(from, to)(t);
}
```

### 2. Numeric / length-px / angle-deg — manual lerp

A single-line lerp is sufficient and has no external dependency:

```ts
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
```

Each type has a parser (strips suffix) and serializer (adds suffix back).

### 3. Transform sub-properties — independent primitives + composer

`transform` is NOT a directly-animatable key. The animatable keys are:

| Key                    | Type       | CSS function  |
|------------------------|------------|---------------|
| `transform.translateX` | length-px  | `translate(X, Y)` |
| `transform.translateY` | length-px  | `translate(X, Y)` |
| `transform.scale`      | numeric    | `scale(n)` |
| `transform.rotate`     | angle-deg  | `rotate(ndeg)` |

Each sub-property is interpolated independently as a primitive. A `composeTransform` function joins the results into a deterministic CSS string (translate → scale → rotate order). This avoids having to parse arbitrary `transform` strings from user input.

### 4. Cubic-bezier solver — `bezier-easing`

`bezier-easing` solves `cubic-bezier(p1, p2, p3, p4)` given a linear `t`.
Instantiation cost is negligible (microseconds); no caching needed for v1.

The named easings (`ease-in`, `ease-out`, `ease-in-out`) are implemented as
fixed cubic-bezier instances at module load time.

### 5. Spring easing — Remotion `spring()`

Remotion's `spring({ frame, fps, config, durationInFrames })` is used directly.
`durationInFrames` is set to the segment length (`kfB.frame - kfA.frame`).
The spring naturally settles by segment end for default configs; aggressive
configs may overshoot — this is by design and visible in the easing preview UI.

## Consequences

- `mixColor` (not `mix`) must be used in `color.ts`. All plan snippets that
  reference `mix(colorString, colorString, t)` must be corrected to
  `mixColor(from, to)(t)`.
- No other library is needed for color; `colord` fallback is not required.
- Transform parsing from raw CSS strings is out of scope for v1.
