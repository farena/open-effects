"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Undo2, Redo2, Film, ArrowLeft, Sparkles, Pencil, Save } from "lucide-react";
import { useEditorStore } from "@/editor/store";
import { saveProjectNow } from "@/editor/useAutosave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SaveStatus } from "@/editor/store.types";
import { RenderModal } from "./RenderModal";
import { ProjectChat } from "@/components/project-chat/ProjectChat";

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

function RenameProjectDialog({
  open,
  onOpenChange,
  currentName,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(currentName);

  useEffect(() => {
    if (open) setValue(currentName);
  }, [open, currentName]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== currentName;

  const handleSave = () => {
    if (!canSave) return;
    onSave(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder="Project name"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Topbar() {
  const project = useEditorStore((s) => s.project);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
  const updateProjectName = useEditorStore((s) => s.updateProjectName);
  const [chatOpen, setChatOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

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
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">
            {project.name || "Untitled"}
          </span>
          {project.id && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground"
                    onClick={() => setRenameOpen(true)}
                    aria-label="Rename project"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rename project</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <UndoRedoButtons />
      </div>

      <SaveIndicator
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        setSaveStatus={setSaveStatus}
      />

      <div className="flex items-center gap-2">
        {project.id && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-1.5"
            aria-label="Open AI assistant"
          >
            <Sparkles className="h-4 w-4" />
            AI
          </Button>
        )}
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
        {project.id && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void saveProjectNow()}
            disabled={saveStatus === "saving"}
            className="flex items-center gap-1.5"
            aria-label="Save project"
          >
            <Save className="h-4 w-4" />
            {saveStatus === "saving" ? "Saving…" : "Save"}
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

      {project.id && (
        <ProjectChat
          projectId={project.id}
          projectName={project.name || "Untitled"}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}

      {project.id && (
        <RenameProjectDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          currentName={project.name || ""}
          onSave={updateProjectName}
        />
      )}
    </div>
  );
}
