import { useEffect } from "react";
import { toast } from "sonner";
import { useEditorStore } from "./store";

// Edits typically come in bursts (typing in Monaco, dragging a slider).
// Wait this long after the last change before persisting so a flurry
// gets coalesced into a single PATCH carrying the latest project.
const AUTOSAVE_DEBOUNCE_MS = 5000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function performSave(): Promise<void> {
  const { project, setSaveStatus, markSaved } = useEditorStore.getState();
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
    console.error("save failed", e);
    setSaveStatus("error");
    toast.error("Save failed", {
      description: e instanceof Error ? e.message : String(e),
    });
  }
}

// Cancels any pending autosave debounce and PATCHes immediately. Called by
// the manual Save button so we don't double-PATCH 5s later with the same data.
export async function saveProjectNow(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  await performSave();
}

export function useAutosave() {
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
      if (debounceTimer) clearTimeout(debounceTimer);
      useEditorStore.getState().setSaveStatus("idle");
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void performSave();
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };
  }, []);
}
