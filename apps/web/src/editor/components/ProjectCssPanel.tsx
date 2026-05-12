"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MonacoLazy } from "./MonacoLazy";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/editor/store";
import { formatScss } from "@/editor/lib/format";

export function ProjectCssPanel() {
  const css = useEditorStore((s) => s.project.css ?? "");
  const update = useEditorStore((s) => s.updateProjectCss);
  const [formatting, setFormatting] = useState(false);

  async function handleFormat() {
    if (formatting) return;
    setFormatting(true);
    try {
      const formatted = await formatScss(css);
      update(formatted);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not format";
      toast.error("Format failed", { description: message });
    } finally {
      setFormatting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Project CSS
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            Global styles shared across every scene and layer
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleFormat}
          disabled={formatting}
        >
          {formatting ? "Formatting…" : "Format"}
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <MonacoLazy
          className="absolute inset-0"
          height="100%"
          defaultLanguage="scss"
          value={css}
          onChange={(v) => update(v ?? "")}
          options={{
            minimap: { enabled: false },
            wordWrap: "on",
            fontSize: 13,
          }}
        />
      </div>
    </div>
  );
}
