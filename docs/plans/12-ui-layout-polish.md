# Plan 12 — UI / Layout Polish (vertical sidebar, resizable timeline, back-to-projects)

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read `00-master-plan.md` and `09-polish.md` first. This plan is post-v1 (consumed from `10-following-steps.md`, items 4–6). It contains three independent UI tweaks that all live in `apps/web/src/editor/components/`. Tasks are independent and may be executed in any order, but the recommended order below minimizes context switching.

**Goal:**
1. The Sidebar's tab strip becomes a **vertical icon-only rail with tooltips** (Scenes / Layers / Assets / Components), recovering ~24px of horizontal label space.
2. The Timeline row is **vertically resizable** by a top-edge handle, clamped to `min(45vh, hardCap=900) ≥ height ≥ 250px`.
3. The Topbar gains a **"Back to projects"** button at the very left, linking to `/projects`.

**Architecture:**
- Sidebar: `Tabs` orientation stays default but the `TabsList` is moved into a left rail (a `<nav>` of `<TabsTrigger>` rendered as icon-only buttons inside `<Tooltip>` wrappers). Existing panels are unchanged. Tab keyboard a11y is preserved by Radix `Tabs`.
- Timeline resize: `Editor.tsx` already uses CSS Grid with `gridTemplateRows: "auto 1fr 300px"`. We replace the constant `300` with a state + persisted preference (`localStorage` key `oe-editor-timeline-h`), adding a 4px resizer above the timeline area (analogous to the existing inspector vertical resizer at `gridArea: "resizer"`). The clamp pulls a live `45vh` cap from `window.innerHeight` (re-measured on resize event with simple debouncing — `requestAnimationFrame`).
- Topbar back button: a `Link` with `ArrowLeft` icon at the head of the left cluster (before project name + Undo/Redo). No change to other regions.

**Tech Stack additions:** none (lucide icons + shadcn primitives already installed).

---

## Acceptance criteria

1. **Sidebar vertical rail.**
   - Tab triggers render as 32×32 icon buttons in a vertical column on the left edge of the Sidebar container.
   - Each trigger shows a tooltip on hover with the tab's full label (`"Scenes"`, `"Layers"`, `"Assets"`, `"Components"`).
   - Active tab state visually distinguished (background tint or 2px left border).
   - Keyboard navigation (Up/Down arrow keys, Home/End) still cycles tabs (Radix default behavior preserved).
2. **Timeline resize.**
   - A horizontal handle is rendered along the top edge of the timeline row, cursor `row-resize`, ARIA separator with `aria-orientation="horizontal"`.
   - Drag adjusts timeline height live; releases save the new height to `localStorage`.
   - Height is clamped: `max(250, min(window.innerHeight * 0.45, 900))` upper bound, `250` lower bound. Window resize re-clamps and persists.
   - Reload restores the saved height (within current viewport's clamp).
3. **Back-to-projects.**
   - `ArrowLeft` icon button at the very left of the Topbar, before the project name. Tooltip `"Back to projects"`.
   - Click navigates to `/projects` via `next/link` (client navigation, no full page reload).
   - Visible only when `project.id` is truthy (mirrors the existing `Renders` button conditional in Topbar).

---

## File structure

```
apps/web/
├── src/
│   ├── editor/
│   │   ├── components/
│   │   │   ├── Sidebar.tsx                # MODIFY: vertical icon rail + tooltips
│   │   │   ├── Topbar.tsx                 # MODIFY: ArrowLeft Link button
│   │   │   ├── Editor.tsx                 # MODIFY: dynamic timeline height + horizontal resizer row
│   │   │   └── timeline/
│   │   │       └── TimelineResizer.tsx    # NEW: top-edge horizontal handle
│   │   └── lib/
│   │       └── timelineHeight.ts          # NEW: clamp + localStorage helpers
└── tests/
    └── editor/
        └── timelineHeight.test.ts         # NEW
```

---

## Acceptance criteria → tasks map

| AC | Tasks |
|---|---|
| 1. Sidebar vertical rail + tooltips | T1 |
| 2. Timeline resize + clamp + persistence | T2, T3, T4 |
| 3. Back-to-projects button | T5 |

---

## Task list (execution order)

### Task 1: Sidebar vertical icon tabs

**Files:**
- Modify: `apps/web/src/editor/components/Sidebar.tsx`

- [ ] **Step 1:** Import lucide icons and `Tooltip` primitives:
  ```tsx
  import { Film, Layers as LayersIcon, Image as ImageIcon, Boxes } from "lucide-react";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  ```
- [ ] **Step 2:** Refactor the layout from a top tab-strip + content to a 2-column flex:
  - Left column (`w-10 shrink-0 border-r bg-muted/40`): vertical column of `TabsTrigger` rendered as icon-only 32×32 buttons. Each wrapped in `<Tooltip>` with `side="right"`. Active tab shown via `data-[state=active]:bg-accent data-[state=active]:border-l-2 data-[state=active]:border-primary` Tailwind variants on the trigger.
  - Right column (`flex-1 min-w-0`): the existing `TabsContent` blocks for `scenes` / `layers` / `assets` / `components`.
- [ ] **Step 3:** Mapping:
  - `scenes` → `Film`
  - `layers` → `LayersIcon`
  - `assets` → `ImageIcon`
  - `components` → `Boxes`
- [ ] **Step 4:** Verify keyboard Up/Down navigation still cycles tabs (Radix `Tabs` honors `orientation="vertical"` if specified — set it on the root). Add `orientation="vertical"` to `<Tabs>`.
- [ ] **Step 5:** Manual: tab through with keyboard, hover each icon, confirm tooltip appears, confirm panel switches.
- [ ] **Step 6:** Commit: `feat(editor): vertical icon sidebar tabs`.

---

### Task 2: Timeline-height utility (TDD)

**Files:**
- Create: `apps/web/src/editor/lib/timelineHeight.ts`, `apps/web/tests/editor/timelineHeight.test.ts`

- [ ] **Step 1:** Failing tests for pure functions:
  - `clampTimelineHeight(800, 1000)` → with viewport 1000 → max=`min(450, 900)=450` → returns 450.
  - `clampTimelineHeight(800, 2400)` → with viewport 2400 → max=`min(1080, 900)=900` → returns 800.
  - `clampTimelineHeight(100, 1000)` → returns 250 (lower bound).
  - `clampTimelineHeight(NaN, 1000)` → returns the default (300).
  - `readSavedHeight()` returns `null` if `localStorage` key absent or value not a finite number.
- [ ] **Step 2:** Implement:
  ```ts
  export const TIMELINE_HEIGHT_KEY = "oe-editor-timeline-h";
  export const TIMELINE_MIN = 250;
  export const TIMELINE_HARD_MAX = 900;
  export const TIMELINE_DEFAULT = 300;

  export function clampTimelineHeight(h: number, viewportH: number): number {
    if (!Number.isFinite(h)) return TIMELINE_DEFAULT;
    const upper = Math.min(Math.floor(viewportH * 0.45), TIMELINE_HARD_MAX);
    return Math.max(TIMELINE_MIN, Math.min(upper, h));
  }

  export function readSavedHeight(): number | null {
    try {
      const raw = localStorage.getItem(TIMELINE_HEIGHT_KEY);
      if (!raw) return null;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    } catch { return null; }
  }

  export function writeSavedHeight(h: number): void {
    try { localStorage.setItem(TIMELINE_HEIGHT_KEY, String(h)); } catch {}
  }
  ```
- [ ] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(editor): timelineHeight utility`.

---

### Task 3: TimelineResizer component

**Files:**
- Create: `apps/web/src/editor/components/timeline/TimelineResizer.tsx`

- [ ] **Step 1:** Implement a 4px-tall horizontal handle:
  ```tsx
  "use client";
  import { useCallback, useRef } from "react";

  export function TimelineResizer({
    height, onResize, onCommit,
  }: {
    height: number;
    onResize: (next: number) => void;   // live (clamped)
    onCommit: (final: number) => void;  // on pointer up — persists
  }) {
    const startY = useRef(0);
    const startH = useRef(0);
    const draggingRef = useRef(false);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = true;
      startY.current = e.clientY;
      startH.current = height;
      e.currentTarget.setPointerCapture(e.pointerId);
    }, [height]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const dy = startY.current - e.clientY; // up = grow
      onResize(startH.current + dy);
    }, [onResize]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
      onCommit(height);
    }, [height, onCommit]);

    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline"
        className="h-1 cursor-row-resize border-y border-border/60 bg-muted/50 hover:bg-accent/50 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    );
  }
  ```
- [ ] **Step 2:** Commit: `feat(editor): TimelineResizer component`.

---

### Task 4: Wire dynamic timeline height into Editor.tsx

**Files:**
- Modify: `apps/web/src/editor/components/Editor.tsx`

- [ ] **Step 1:** Add state + viewport-tracked clamp:
  ```ts
  const [timelineH, setTimelineH] = useState(TIMELINE_DEFAULT);
  const [viewportH, setViewportH] = useState(
    typeof window === "undefined" ? 800 : window.innerHeight,
  );
  // hydrate from localStorage on mount
  useEffect(() => {
    const saved = readSavedHeight();
    if (saved != null) setTimelineH(clampTimelineHeight(saved, window.innerHeight));
  }, []);
  // viewport tracking (rAF throttle)
  useEffect(() => {
    let raf: number | null = null;
    const onResize = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        setViewportH(window.innerHeight);
        setTimelineH((h) => clampTimelineHeight(h, window.innerHeight));
      });
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (raf) cancelAnimationFrame(raf); };
  }, []);
  ```
- [ ] **Step 2:** Update grid template:
  ```ts
  gridTemplateRows: `auto 1fr 4px ${timelineH}px`,
  gridTemplateAreas: `
    "topbar           topbar     topbar     topbar"
    "assets           preview    resizer    properties"
    "timelineResizer  timelineResizer  resizer  properties"
    "timeline         timeline   resizer    properties"
  `,
  ```
- [ ] **Step 3:** Add the new grid area:
  ```tsx
  <div style={{ gridArea: "timelineResizer" }}>
    <TimelineResizer
      height={timelineH}
      onResize={(h) => setTimelineH(clampTimelineHeight(h, viewportH))}
      onCommit={(h) => writeSavedHeight(h)}
    />
  </div>
  ```
- [ ] **Step 4:** Verify the timeline + resizer don't overlap the inspector resizer (`resizer` area spans rows 2–4 → adjust the grid to span only rows where the inspector exists). Adjust `gridTemplateAreas` so `resizer` covers `preview/timeline` rows but NOT the timelineResizer row, or place the timelineResizer to the LEFT of `resizer` only — pick whichever creates a visually clean intersection.
  - Suggested layout: timelineResizer occupies cols 1-2 only; the inspector vertical resizer keeps its own column 3 spanning rows 2-4. They meet but never cross.
- [ ] **Step 5:** Manual: drag the top edge of the timeline up and down → see live resize, clamped at top at ~45% of viewport, no glitches when dragging past the cap. Reload → height restored. Resize the browser narrower / vertically smaller → clamp re-applies (timeline shrinks if necessary).
- [ ] **Step 6:** Commit: `feat(editor): resizable timeline row`.

---

### Task 5: Topbar Back-to-projects button

**Files:**
- Modify: `apps/web/src/editor/components/Topbar.tsx`

- [ ] **Step 1:** Add the button to the left cluster, before the project name:
  ```tsx
  import { ArrowLeft } from "lucide-react";
  // ...
  {project.id && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild aria-label="Back to projects">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Back to projects</TooltipContent>
    </Tooltip>
  )}
  ```
  Place it inside the existing `TooltipProvider` (factor it out to wrap the whole Topbar's left cluster, OR add a fresh provider — simplest: wrap just this and the existing UndoRedoButtons under one `<TooltipProvider delayDuration={300}>`).
- [ ] **Step 2:** Manual: confirm clicking the arrow returns to `/projects` without a full page reload (React Router/client navigation), tooltip shows on hover.
- [ ] **Step 3:** Commit: `feat(editor): topbar back-to-projects button`.

---

## Test summary

| Test | Type | File |
|---|---|---|
| `clampTimelineHeight` (4 cases) + `readSavedHeight` (2 cases) | unit | `tests/editor/timelineHeight.test.ts` |
| Sidebar vertical tabs keyboard a11y | manual | browser |
| Timeline resize live + persistence | manual | browser |
| Window-resize re-clamp | manual | browser |
| Back-to-projects link | manual | browser |

---

## Risks

| Risk | Mitigation |
|---|---|
| Sidebar icon-only tabs lose discoverability for new users | Tooltips on hover + active state visual; future onboarding tooltip overlay can layer on top. |
| Timeline resize fights with inspector resize visually | Grid layout keeps the two resizers in distinct columns/rows that never overlap; both have visible 1px borders for clarity. |
| Saved height exceeds new viewport on reload | `clampTimelineHeight` is applied on hydration AND on window resize — never trust the saved value blindly. |
| Pointer capture leaks if pointercancel doesn't fire | `TimelineResizer` handles `onPointerCancel` (re-uses `onPointerUp`) → safe. |
| `next/link` inside shadcn `Button asChild` requires the child to forward refs | shadcn `Button` already supports `asChild` via `Slot`; `next/link` accepts `legacyBehavior={false}` (default in Next 13+) and renders an `<a>` directly — works without wrappers. |
| Tabs `orientation="vertical"` with `TabsList` styled differently from default | Validate Radix's a11y in T1 step 4; if Up/Down arrows fail, fall back to keeping `orientation` default and use `aria-orientation="vertical"` on the wrapper only. |
| `45vh` cap feels too small on tall ultra-wide monitors | Hard cap at 900px also enforced; users with 4K monitors get a generous timeline without dominating the canvas. Override path documented (edit `TIMELINE_HARD_MAX`). |

---

## Final task checklist

- [x] T1 — Sidebar vertical icon tabs
- [x] T2 — `timelineHeight` utility (TDD)
- [x] T3 — `TimelineResizer` component
- [x] T4 — Wire dynamic timeline height in Editor.tsx
- [x] T5 — Topbar back-to-projects button

**Total tasks:** 5 · **Estimate:** 3–4 days. · **Critical risks:** grid intersection between vertical inspector-resizer and horizontal timeline-resizer (T4 step 4) — verify visually.
