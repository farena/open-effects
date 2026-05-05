import { useEffect, useRef } from "react";
import { useEditorStore } from "./store";

export function useAutosave() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let prevProject = useEditorStore.getState().project;
    const unsub = useEditorStore.subscribe((state) => {
      if (state.project === prevProject) return;
      prevProject = state.project;
      if (timer.current) clearTimeout(timer.current);
      useEditorStore.getState().setSaveStatus("idle");
      timer.current = setTimeout(async () => {
        const { project, setSaveStatus, markSaved } =
          useEditorStore.getState();
        if (!project.id) return;
        setSaveStatus("saving");
        try {
          const res = await fetch(`/api/projects/${project.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(project),
          });
          if (!res.ok) throw new Error(await res.text());
          markSaved();
        } catch (e) {
          console.error("autosave failed", e);
          setSaveStatus("error");
        }
      }, 1000);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}
