"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MonacoLazy } from "../MonacoLazy";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/editor/store";
import { selectActiveLayer } from "@/editor/selectors";
import { formatScss } from "@/editor/lib/format";

export function CssTab() {
  const layer = useEditorStore(selectActiveLayer);
  const update = useEditorStore((s) => s.updateLayerCss);
  const [formatting, setFormatting] = useState(false);

  if (!layer) return null;

  async function handleFormat() {
    if (!layer || formatting) return;
    setFormatting(true);
    try {
      const formatted = await formatScss(layer.css);
      update(layer.id, formatted);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not format";
      toast.error("Format failed", { description: message });
    } finally {
      setFormatting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          SCSS
        </span>
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
          value={layer.css}
          onChange={(v) => update(layer.id, v ?? "")}
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
