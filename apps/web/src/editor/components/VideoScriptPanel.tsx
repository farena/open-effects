"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/editor/store";
import { newId } from "@/lib/ids";
import type { VideoScriptLine } from "@open-effects/shared-types";
import { LoadingSkeleton, ErrorBlock } from "@/components/ui/feedback";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "./EmptyState";

type Phase =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready" };

const SAVE_DEBOUNCE_MS = 600;

function makeLine(): VideoScriptLine {
  return { id: newId("vsl_"), timestamp: "00:00", text: "" };
}

export function VideoScriptPanel() {
  const projectId = useEditorStore((s) => s.project.id);
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  const [lines, setLines] = useState<VideoScriptLine[]>([]);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Track the script we last persisted so the polling effect knows when the
  // agent has rewritten it from outside the panel and we should refresh.
  const remoteSnapshotRef = useRef<string>("[]");
  const localSnapshotRef = useRef<string>("[]");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchScript = useCallback(
    async (signal?: AbortSignal): Promise<VideoScriptLine[] | null> => {
      if (!projectId) return null;
      const res = await fetch(`/api/projects/${projectId}/script`, {
        cache: "no-store",
        signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { lines: VideoScriptLine[] };
      return data.lines ?? [];
    },
    [projectId],
  );

  // Initial load
  useEffect(() => {
    if (!projectId) return;
    const ctrl = new AbortController();
    setPhase({ status: "loading" });
    void (async () => {
      try {
        const fetched = await fetchScript(ctrl.signal);
        if (ctrl.signal.aborted || fetched === null) return;
        setLines(fetched);
        const snap = JSON.stringify(fetched);
        remoteSnapshotRef.current = snap;
        localSnapshotRef.current = snap;
        setPhase({ status: "ready" });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setPhase({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => ctrl.abort();
  }, [projectId, fetchScript]);

  // Poll every 5s for agent-driven changes — only refresh when the user has
  // no pending local edits, otherwise we'd clobber what they're typing.
  useEffect(() => {
    if (!projectId || phase.status !== "ready") return;
    const id = setInterval(() => {
      if (saveStatus === "saving") return;
      if (localSnapshotRef.current !== remoteSnapshotRef.current) return;
      void (async () => {
        try {
          const fetched = await fetchScript();
          if (fetched === null) return;
          const snap = JSON.stringify(fetched);
          if (snap === remoteSnapshotRef.current) return;
          remoteSnapshotRef.current = snap;
          localSnapshotRef.current = snap;
          setLines(fetched);
        } catch {
          // ignore polling errors
        }
      })();
    }, 5000);
    return () => clearInterval(id);
  }, [projectId, phase.status, saveStatus, fetchScript]);

  const persist = useCallback(
    async (next: VideoScriptLine[]) => {
      if (!projectId) return;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/projects/${projectId}/script`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const snap = JSON.stringify(next);
        remoteSnapshotRef.current = snap;
        localSnapshotRef.current = snap;
        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("error");
        toast.error("Could not save script", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [projectId],
  );

  const scheduleSave = useCallback(
    (next: VideoScriptLine[]) => {
      localSnapshotRef.current = JSON.stringify(next);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void persist(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  // Flush pending edits before unmount so navigating away doesn't lose them.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        if (localSnapshotRef.current !== remoteSnapshotRef.current) {
          const pending = JSON.parse(
            localSnapshotRef.current,
          ) as VideoScriptLine[];
          void persist(pending);
        }
      }
    };
  }, [persist]);

  const updateLine = (id: string, patch: Partial<VideoScriptLine>) => {
    setLines((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
      scheduleSave(next);
      return next;
    });
  };

  const addLine = () => {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      const newLine = makeLine();
      if (last?.timestamp) newLine.timestamp = last.timestamp;
      const next = [...prev, newLine];
      scheduleSave(next);
      return next;
    });
  };

  const deleteLine = (id: string) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.id !== id);
      scheduleSave(next);
      return next;
    });
  };

  const flushNow = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void persist(lines);
  };

  if (!projectId) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Save the project first to edit its script.
      </div>
    );
  }

  if (phase.status === "loading") {
    return (
      <div className="p-3">
        <LoadingSkeleton />
      </div>
    );
  }

  if (phase.status === "error") {
    return (
      <div className="p-3">
        <ErrorBlock
          message={`Could not load script: ${phase.error}`}
          onRetry={() => {
            setPhase({ status: "loading" });
            void (async () => {
              try {
                const fetched = await fetchScript();
                if (fetched === null) return;
                setLines(fetched);
                const snap = JSON.stringify(fetched);
                remoteSnapshotRef.current = snap;
                localSnapshotRef.current = snap;
                setPhase({ status: "ready" });
              } catch (err) {
                setPhase({
                  status: "error",
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            })();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Video script
        </span>
        <div className="flex items-center gap-1">
          <span
            className="text-[10px] text-muted-foreground"
            aria-live="polite"
          >
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && (
              <span className="text-destructive">Save error</span>
            )}
          </span>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={flushNow}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Save now"
                >
                  <Save className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Save now</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Add line"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Add line</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2">
        {lines.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No script yet"
            description="Add lines with a timestamp and the voice-over text. The AI assistant can also write or edit this."
            action={{ label: "Add first line", onClick: addLine }}
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {lines.map((line) => (
              <li
                key={line.id}
                className="group flex items-start gap-2 rounded-md border border-border/40 bg-background p-2 hover:border-border"
              >
                <input
                  type="text"
                  value={line.timestamp}
                  onChange={(e) =>
                    updateLine(line.id, { timestamp: e.target.value })
                  }
                  placeholder="00:00"
                  className="w-16 shrink-0 rounded border border-border bg-background px-1.5 py-1 text-xs font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                  aria-label="Line timestamp"
                />
                <textarea
                  value={line.text}
                  onChange={(e) =>
                    updateLine(line.id, { text: e.target.value })
                  }
                  placeholder="Voice-over text…"
                  rows={2}
                  className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-xs leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                  aria-label="Line text"
                />
                <button
                  type="button"
                  onClick={() => deleteLine(line.id)}
                  className="invisible group-hover:visible shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label="Delete line"
                  title="Delete line"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
