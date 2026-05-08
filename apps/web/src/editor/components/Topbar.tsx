"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Undo2, Redo2, Film, ArrowLeft } from "lucide-react";
import { useEditorStore } from "@/editor/store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SaveStatus } from "@/editor/store.types";
import { RenderModal } from "./RenderModal";

function UndoRedoButtons() {
  const [, force] = useState(0);

  useEffect(() => {
    const unsub = useEditorStore.temporal.subscribe(() => force((n) => n + 1));
    return () => unsub();
  }, []);

  const temporal = useEditorStore.temporal.getState();
  const canUndo = temporal.pastStates.length > 0;
  const canRedo = temporal.futureStates.length > 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!canUndo}
              onClick={() => useEditorStore.temporal.getState().undo()}
              aria-label="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl/Cmd+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!canRedo}
              onClick={() => useEditorStore.temporal.getState().redo()}
              aria-label="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl/Cmd+Shift+Z)</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

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
      <div className="flex items-center gap-3">
        {project.id && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  asChild
                  aria-label="Back to projects"
                >
                  <Link href="/projects">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to projects</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span className="text-sm font-medium">
          {project.name || "Untitled"}
        </span>
        <UndoRedoButtons />
      </div>

      <SaveIndicator
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        setSaveStatus={setSaveStatus}
      />

      <div className="flex items-center gap-2">
        {project.id && (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/projects/${project.id}/renders`}
              className="flex items-center gap-1.5"
            >
              <Film className="h-4 w-4" />
              Renders
            </Link>
          </Button>
        )}
        <RenderModal
          projectId={project.id}
          trigger={
            <Button variant="default" size="sm">
              Render
            </Button>
          }
        />
      </div>
    </div>
  );
}
