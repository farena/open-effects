"use client";
import { useState, useCallback } from "react";

export type RenderState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "running"; renderId: string; progress: number; status: string }
  | { phase: "done"; outputUrl: string }
  | { phase: "error"; error: string };

export function useRender(projectId: string) {
  const [state, setState] = useState<RenderState>({ phase: "idle" });

  const start = useCallback(async () => {
    setState({ phase: "starting" });
    const res = await fetch(`/api/render/${projectId}`, { method: "POST" });
    if (!res.ok) {
      setState({ phase: "error", error: await res.text() });
      return;
    }
    const { renderId } = (await res.json()) as { renderId: string };
    setState({ phase: "running", renderId, progress: 0, status: "queued" });

    const es = new EventSource(`/api/render/${projectId}/${renderId}/events`);
    es.onmessage = (ev) => {
      const job = JSON.parse(ev.data) as {
        status: string;
        progress: number;
        outputUrl?: string;
        error?: string;
      };
      if (job.status === "completed") {
        setState({ phase: "done", outputUrl: job.outputUrl ?? "" });
        es.close();
      } else if (job.status === "error") {
        setState({ phase: "error", error: job.error ?? "render_failed" });
        es.close();
      } else {
        setState({
          phase: "running",
          renderId,
          progress: job.progress,
          status: job.status,
        });
      }
    };
    es.onerror = () => {
      setState({ phase: "error", error: "stream_lost" });
      es.close();
    };
  }, [projectId]);

  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, start, reset };
}
