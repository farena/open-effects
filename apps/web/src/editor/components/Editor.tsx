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
  // Grid mirrors docs/screenshots/editor-layout.png:
  //   row 1 — topbar (full width)
  //   row 2 — assets | preview | properties
  //   row 3 — timeline (cols 1-2) | properties (continues)
  return (
    <div
      className="grid h-screen overflow-hidden"
      style={{
        gridTemplateColumns: "260px 1fr 340px",
        gridTemplateRows: "auto 1fr 300px",
        gridTemplateAreas: `
          "topbar     topbar     topbar"
          "assets     preview    properties"
          "timeline   timeline   properties"
        `,
      }}
    >
      <div style={{ gridArea: "topbar" }}><Topbar /></div>
      <div style={{ gridArea: "assets" }} className="overflow-hidden"><Sidebar /></div>
      <div style={{ gridArea: "preview" }} className="overflow-hidden"><PreviewPane /></div>
      <div style={{ gridArea: "properties" }} className="overflow-hidden border-l"><Inspector /></div>
      <div style={{ gridArea: "timeline" }} className="overflow-hidden border-t"><Timeline /></div>
    </div>
  );
}
