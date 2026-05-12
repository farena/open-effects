"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/editor/store";
import { useAutosave } from "@/editor/useAutosave";
import { useUndoRedo } from "@/editor/useUndoRedo";
import {
  clampTimelineHeight,
  readSavedHeight,
  writeSavedHeight,
  TIMELINE_DEFAULT,
} from "@/editor/lib/timelineHeight";
import type { Project } from "@open-effects/shared-types";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { PreviewPane } from "./PreviewPane";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";
import { TimelineResizer } from "./timeline/TimelineResizer";

const INSPECTOR_WIDTH_KEY = "oe-editor-inspector-width";
const DEFAULT_INSPECTOR_WIDTH = 340;
const MIN_INSPECTOR_WIDTH = 290;
const MAX_INSPECTOR_WIDTH = 720;

const SIDEBAR_WIDTH_KEY = "oe-editor-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 500;

function clampInspectorWidth(n: number): number {
  return Math.min(
    MAX_INSPECTOR_WIDTH,
    Math.max(MIN_INSPECTOR_WIDTH, Math.round(n)),
  );
}

function clampSidebarWidth(n: number): number {
  return Math.min(
    MAX_SIDEBAR_WIDTH,
    Math.max(MIN_SIDEBAR_WIDTH, Math.round(n)),
  );
}

export function Editor({ initialProject }: { initialProject: Project }) {
  const setProject = useEditorStore((s) => s.setProject);
  const [inspectorWidth, setInspectorWidth] = useState(DEFAULT_INSPECTOR_WIDTH);
  const inspectorWidthRef = useRef(DEFAULT_INSPECTOR_WIDTH);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(DEFAULT_INSPECTOR_WIDTH);

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const sidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const sidebarDragStartXRef = useRef(0);
  const sidebarDragStartWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);

  // Timeline height state
  const [timelineH, setTimelineH] = useState(TIMELINE_DEFAULT);
  const [viewportH, setViewportH] = useState(
    typeof window === "undefined" ? 800 : window.innerHeight,
  );

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject, setProject]);
  useAutosave();
  useUndoRedo();

  // Hydrate inspector width from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(INSPECTOR_WIDTH_KEY);
      if (raw == null) return;
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      const w = clampInspectorWidth(parsed);
      setInspectorWidth(w);
      inspectorWidthRef.current = w;
    } catch {
      // ignore
    }
  }, []);

  // Hydrate sidebar width from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      if (raw == null) return;
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      const w = clampSidebarWidth(parsed);
      setSidebarWidth(w);
      sidebarWidthRef.current = w;
    } catch {
      // ignore
    }
  }, []);

  // Hydrate timeline height from localStorage on mount
  useEffect(() => {
    const saved = readSavedHeight();
    if (saved != null) setTimelineH(clampTimelineHeight(saved, window.innerHeight));
  }, []);

  // Viewport tracking for timeline height clamp (rAF throttle)
  useEffect(() => {
    let raf: number | null = null;
    const onResize = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const vh = window.innerHeight;
        setViewportH(vh);
        setTimelineH((h) => {
          const clamped = clampTimelineHeight(h, vh);
          if (clamped !== h) writeSavedHeight(clamped);
          return clamped;
        });
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const onInspectorResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = inspectorWidth;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [inspectorWidth],
  );

  const onInspectorResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const delta = e.clientX - dragStartXRef.current;
      const next = clampInspectorWidth(dragStartWidthRef.current - delta);
      inspectorWidthRef.current = next;
      setInspectorWidth(next);
    },
    [],
  );

  const onInspectorResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      try {
        localStorage.setItem(
          INSPECTOR_WIDTH_KEY,
          String(inspectorWidthRef.current),
        );
      } catch {
        // ignore
      }
    },
    [],
  );

  const onSidebarResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      sidebarDragStartXRef.current = e.clientX;
      sidebarDragStartWidthRef.current = sidebarWidth;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [sidebarWidth],
  );

  const onSidebarResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const delta = e.clientX - sidebarDragStartXRef.current;
      const next = clampSidebarWidth(sidebarDragStartWidthRef.current + delta);
      sidebarWidthRef.current = next;
      setSidebarWidth(next);
    },
    [],
  );

  const onSidebarResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      try {
        localStorage.setItem(
          SIDEBAR_WIDTH_KEY,
          String(sidebarWidthRef.current),
        );
      } catch {
        // ignore
      }
    },
    [],
  );

  // Grid layout:
  //   row 1 — topbar (full width)
  //   row 2 — assets | leftResizer | preview | resizer | properties
  //   row 3 — timelineResizer (cols 1-3) | resizer | properties
  //   row 4 — timeline (cols 1-3) | resizer | properties
  //
  // The inspector vertical resizer (col 4) spans rows 2-4.
  // The sidebar vertical resizer (col 2) only occupies row 2.
  // The timeline horizontal resizer occupies cols 1-3 of row 3 only,
  // so the resizers never overlap.
  return (
    <div
      className="grid h-screen overflow-hidden"
      style={{
        gridTemplateColumns: `${sidebarWidth}px 6px minmax(0, 1fr) 6px ${inspectorWidth}px`,
        gridTemplateRows: `auto 1fr 4px ${timelineH}px`,
        gridTemplateAreas: `
          "topbar           topbar           topbar           topbar     topbar"
          "assets           leftResizer      preview          resizer    properties"
          "timelineResizer  timelineResizer  timelineResizer  resizer    properties"
          "timeline         timeline         timeline         resizer    properties"
        `,
      }}
    >
      <div style={{ gridArea: "topbar" }}>
        <Topbar />
      </div>
      <div style={{ gridArea: "assets" }} className="overflow-hidden">
        <Sidebar />
      </div>
      <div
        style={{ gridArea: "leftResizer" }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar panel"
        className="group relative z-10 cursor-col-resize border-l border-r border-border/60 bg-muted/50 hover:bg-accent/40 touch-none select-none"
        onPointerDown={onSidebarResizePointerDown}
        onPointerMove={onSidebarResizePointerMove}
        onPointerUp={onSidebarResizePointerUp}
        onPointerCancel={onSidebarResizePointerUp}
      >
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-primary/60" />
      </div>
      <div style={{ gridArea: "preview" }} className="overflow-hidden">
        <PreviewPane />
      </div>
      <div
        style={{ gridArea: "resizer" }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize properties panel"
        className="group relative z-10 cursor-col-resize border-l border-r border-border/60 bg-muted/50 hover:bg-accent/40 touch-none select-none"
        onPointerDown={onInspectorResizePointerDown}
        onPointerMove={onInspectorResizePointerMove}
        onPointerUp={onInspectorResizePointerUp}
        onPointerCancel={onInspectorResizePointerUp}
      >
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-primary/60" />
      </div>
      <div
        style={{ gridArea: "properties" }}
        className="min-w-0 overflow-hidden"
      >
        <Inspector />
      </div>
      <div style={{ gridArea: "timelineResizer" }}>
        <TimelineResizer
          height={timelineH}
          onResize={(h) => setTimelineH(clampTimelineHeight(h, viewportH))}
          onCommit={(h) => writeSavedHeight(h)}
        />
      </div>
      <div
        style={{ gridArea: "timeline" }}
        className="overflow-hidden border-t"
      >
        <Timeline />
      </div>
    </div>
  );
}
