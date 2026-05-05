"use client";

import { useEditorStore } from "@/editor/store";
import { Button } from "@/components/ui/button";
import type { SaveStatus } from "@/editor/store.types";
import { RenderModal } from "./RenderModal";

/**
 * Returns a human-readable relative time string for a timestamp (ms).
 * No auto-tick — renders once at mount time, acceptable staleness for v1.
 */
function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 5) return "just now";
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  return new Date(ts).toLocaleTimeString();
}

function SaveIndicator({
  saveStatus,
  lastSavedAt,
  setSaveStatus,
}: {
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  setSaveStatus: (s: SaveStatus) => void;
}) {
  if (saveStatus === "idle") {
    return <span className="text-xs text-muted-foreground">No changes</span>;
  }

  if (saveStatus === "saving") {
    return <span className="text-xs text-muted-foreground">Saving…</span>;
  }

  if (saveStatus === "saved") {
    const timeLabel = lastSavedAt ? relativeTime(lastSavedAt) : "";
    return (
      <span className="text-xs text-muted-foreground">Saved {timeLabel}</span>
    );
  }

  // saveStatus === "error"
  // Retry: reset status to "idle" so the autosave watcher fires on next
  // store mutation. A full re-PATCH would require re-importing the project
  // state here; the simpler approach is sufficient for v1.
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-destructive">Save error</span>
      <Button
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => setSaveStatus("idle")}
      >
        Retry
      </Button>
    </span>
  );
}

export function Topbar() {
  const project = useEditorStore((s) => s.project);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);

  return (
    <div className="flex h-12 items-center justify-between border-b bg-background px-4">
      {/* LEFT: project name (read-only for v1) */}
      <span className="text-sm font-medium">{project.name || "Untitled"}</span>

      {/* CENTER: save status indicator */}
      <SaveIndicator
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        setSaveStatus={setSaveStatus}
      />

      {/* RIGHT: Render button — enabled in Stage 8 */}
      <RenderModal
        projectId={project.id}
        trigger={
          <Button variant="default" size="sm">
            Render
          </Button>
        }
      />
    </div>
  );
}
