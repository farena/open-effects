import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEditorStore } from "./store";

export function useAutosave() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let prevProject = useEditorStore.getState().project;
    const unsub = useEditorStore.subscribe((state) => {
      if (state.project === prevProject) return;
      // Skip the empty-store → real-project transition that fires when
      // <Editor> hydrates from the Server Component fetch. Without this,
      // every page load would PATCH the project back unchanged.
      const wasHydration = !prevProject.id && !!state.project.id;
      prevProject = state.project;
      if (wasHydration) return;
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
          toast.success("Saved", { duration: 1000 });
        } catch (e) {
          console.error("autosave failed", e);
          setSaveStatus("error");
          toast.error("Autosave failed", {
            description: e instanceof Error ? e.message : String(e),
          });
        }
      }, 1000);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}
