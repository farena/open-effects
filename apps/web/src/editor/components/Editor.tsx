"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/editor/store";
import { useAutosave } from "@/editor/useAutosave";
import { useUndoRedo } from "@/editor/useUndoRedo";
import type { Project } from "@open-effects/shared-types";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { PreviewPane } from "./PreviewPane";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";

const INSPECTOR_WIDTH_KEY = "oe-editor-inspector-width";
const DEFAULT_INSPECTOR_WIDTH = 340;
const MIN_INSPECTOR_WIDTH = 290;
const MAX_INSPECTOR_WIDTH = 720;

function clampInspectorWidth(n: number): number {
  return Math.min(
    MAX_INSPECTOR_WIDTH,
    Math.max(MIN_INSPECTOR_WIDTH, Math.round(n)),
  );
}

export function Editor({ initialProject }: { initialProject: Project }) {
  const setProject = useEditorStore((s) => s.setProject);
  const [inspectorWidth, setInspectorWidth] = useState(DEFAULT_INSPECTOR_WIDTH);
  const inspectorWidthRef = useRef(DEFAULT_INSPECTOR_WIDTH);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(DEFAULT_INSPECTOR_WIDTH);

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject, setProject]);
  useAutosave();
  useUndoRedo();

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

  // Grid mirrors docs/screenshots/editor-layout.png:
  //   row 1 — topbar (full width)
  //   row 2 — assets | preview | resizer | properties
  //   row 3 — timeline (cols 1-2) | resizer | properties
  return (
    <div
      className="grid h-screen overflow-hidden"
      style={{
        gridTemplateColumns: `260px minmax(0, 1fr) 6px ${inspectorWidth}px`,
        gridTemplateRows: "auto 1fr 300px",
        gridTemplateAreas: `
          "topbar     topbar     topbar     topbar"
          "assets     preview    resizer    properties"
          "timeline   timeline   resizer    properties"
        `,
      }}
    >
      <div style={{ gridArea: "topbar" }}>
        <Topbar />
      </div>
      <div style={{ gridArea: "assets" }} className="overflow-hidden">
        <Sidebar />
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
      <div
        style={{ gridArea: "timeline" }}
        className="overflow-hidden border-t"
      >
        <Timeline />
      </div>
    </div>
  );
}
