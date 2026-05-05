"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRender } from "@/editor/useRender";

export function RenderModal({
  projectId,
  trigger,
}: {
  projectId: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { state, start, reset } = useRender(projectId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Render project</DialogTitle>
        </DialogHeader>

        {state.phase === "idle" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Render this project to MP4?
            </p>
            <Button onClick={start}>Start render</Button>
          </div>
        )}

        {(state.phase === "starting" || state.phase === "running") && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {state.phase === "running" && state.status === "bundling"
                ? "Bundling…"
                : state.phase === "running" && state.status === "rendering"
                  ? "Rendering…"
                  : "Starting…"}
            </p>
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{
                  width: `${
                    state.phase === "running"
                      ? Math.round(state.progress * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {state.phase === "running"
                ? `${Math.round(state.progress * 100)}%`
                : ""}
            </p>
          </div>
        )}

        {state.phase === "done" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Render complete.</p>
            <div className="flex gap-2">
              <Button asChild>
                <a href={state.outputUrl} download>
                  Download MP4
                </a>
              </Button>
              <Button variant="outline" onClick={reset}>
                Render again
              </Button>
            </div>
          </div>
        )}

        {state.phase === "error" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-destructive">
              Render failed: {state.error}
            </p>
            <Button onClick={reset}>Retry</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
