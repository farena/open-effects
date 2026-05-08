import { useEditorStore } from "@/editor/store";

export async function flushAutosave(): Promise<void> {
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
  } catch (e) {
    setSaveStatus("error");
    throw e;
  }
}
