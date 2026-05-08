"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2, PlusSquare } from "lucide-react";
import { toast } from "sonner";
import type { SavedComponent } from "@open-effects/shared-types";
import { useEditorStore } from "@/editor/store";
import { LoadingSkeleton, ErrorBlock } from "@/components/ui/feedback";

type Phase =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; components: SavedComponent[] };

export function ComponentsPanel() {
  const [phase, setPhase] = useState<Phase>({ status: "loading" });

  const insertSavedComponent = useEditorStore((s) => s.insertSavedComponent);

  const refresh = useCallback(async () => {
    setPhase({ status: "loading" });
    try {
      const res = await fetch("/api/components");
      if (!res.ok) {
        const msg = `HTTP ${res.status}`;
        toast.error("Failed to load components");
        setPhase({ status: "error", error: msg });
        return;
      }
      const data: SavedComponent[] = await res.json();
      setPhase({ status: "ready", components: data });
    } catch (e) {
      toast.error("Failed to load components");
      setPhase({
        status: "error",
        error: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const components = phase.status === "ready" ? phase.components : [];
  const loading = phase.status === "loading";

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Existing instances are not affected.`))
      return;
    const res = await fetch(`/api/components/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Component deleted");
    refresh();
  }

  function handleInsert(component: SavedComponent) {
    insertSavedComponent(component.payload);
    toast.success(`Inserted "${component.name}"`);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1.5 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Components
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1 rounded hover:bg-muted disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {phase.status === "loading" && <LoadingSkeleton rows={4} />}
        {phase.status === "error" && (
          <ErrorBlock message={phase.error} onRetry={refresh} />
        )}
        {phase.status === "ready" && components.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">
            No saved components yet. Use &ldquo;Save as component&hellip;&rdquo;
            on a layer.
          </p>
        )}
        {phase.status === "ready" && components.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {components.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                onInsert={handleInsert}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ComponentCardProps {
  component: SavedComponent;
  onInsert: (component: SavedComponent) => void;
  onDelete: (id: string, name: string) => void;
}

function ComponentCard({ component, onInsert, onDelete }: ComponentCardProps) {
  const firstLetter = component.name.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col rounded border border-border bg-card overflow-hidden">
      {/* Thumbnail */}
      <div className="h-16 w-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
        {component.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={component.preview}
            alt={component.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/20 text-primary font-semibold text-lg select-none">
            {firstLetter}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-1.5 py-1 min-w-0">
        <p
          className="text-xs font-medium truncate leading-tight"
          title={component.name}
        >
          {component.name}
        </p>
        {component.category && (
          <span className="mt-0.5 inline-block rounded bg-muted px-1 py-0 text-[10px] text-muted-foreground leading-tight truncate max-w-full">
            {component.category}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-1.5 pb-1.5 mt-auto">
        <button
          onClick={() => onInsert(component)}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20"
          title="Insert into active scene"
        >
          <PlusSquare className="h-3 w-3 shrink-0" />
          Insert
        </button>
        <button
          onClick={() => onDelete(component.id, component.name)}
          className="flex items-center justify-center rounded p-0.5 text-destructive hover:bg-destructive/10"
          title="Delete component"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
