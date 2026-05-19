"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MonacoLazy } from "../MonacoLazy";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/editor/store";
import { selectActiveLayer } from "@/editor/selectors";
import { formatScss } from "@/editor/lib/format";
import type { Layer } from "@open-effects/shared-types";

export function CssTab() {
  const layer = useEditorStore(selectActiveLayer);
  if (!layer) return null;
  if (layer.type === "subtitle") {
    return <SubtitleCssTab layer={layer} />;
  }
  return <SingleCssEditor layer={layer} />;
}

// ---------------------------------------------------------------------------
// Plain (html) layer: single full-height editor for layer.css
// ---------------------------------------------------------------------------

function SingleCssEditor({ layer }: { layer: Layer }) {
  const update = useEditorStore((s) => s.updateLayerCss);
  const [formatting, setFormatting] = useState(false);

  async function handleFormat() {
    if (formatting) return;
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

// ---------------------------------------------------------------------------
// Subtitle layer: split panel — user CSS on top, preset CSS below.
//
// User CSS (`layer.css`) persists across preset changes and "Regenerate".
// Preset CSS (`layer.subtitle.presetCss`) is auto-generated and gets
// overwritten when the user switches presets or clicks Regenerate; manual
// edits here flip `subtitle.manualOverride` so the regen prompts a confirm.
// ---------------------------------------------------------------------------

function SubtitleCssTab({
  layer,
}: {
  layer: Extract<Layer, { type: "subtitle" }>;
}) {
  const updateCss = useEditorStore((s) => s.updateLayerCss);
  const updatePresetCss = useEditorStore((s) => s.updateSubtitlePresetCss);

  const [formattingUser, setFormattingUser] = useState(false);
  const [formattingPreset, setFormattingPreset] = useState(false);

  async function handleFormatUser() {
    if (formattingUser) return;
    setFormattingUser(true);
    try {
      const formatted = await formatScss(layer.css);
      updateCss(layer.id, formatted);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not format";
      toast.error("Format failed", { description: message });
    } finally {
      setFormattingUser(false);
    }
  }

  async function handleFormatPreset() {
    if (formattingPreset) return;
    setFormattingPreset(true);
    try {
      const formatted = await formatScss(layer.subtitle.presetCss);
      updatePresetCss(layer.id, formatted);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not format";
      toast.error("Format failed", { description: message });
    } finally {
      setFormattingPreset(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* User CSS — top half */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            User SCSS
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleFormatUser}
            disabled={formattingUser}
          >
            {formattingUser ? "Formatting…" : "Format"}
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          <MonacoLazy
            className="absolute inset-0"
            height="100%"
            defaultLanguage="scss"
            value={layer.css}
            onChange={(v) => updateCss(layer.id, v ?? "")}
            options={{
              minimap: { enabled: false },
              wordWrap: "on",
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* Preset CSS — bottom half */}
      <div className="flex min-h-0 flex-1 flex-col border-t-4 border-muted">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Preset SCSS
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              Auto-generated · regenerates on preset change
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleFormatPreset}
            disabled={formattingPreset}
          >
            {formattingPreset ? "Formatting…" : "Format"}
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          <MonacoLazy
            className="absolute inset-0"
            height="100%"
            defaultLanguage="scss"
            value={layer.subtitle.presetCss}
            onChange={(v) => updatePresetCss(layer.id, v ?? "")}
            options={{
              minimap: { enabled: false },
              wordWrap: "on",
              fontSize: 13,
            }}
          />
        </div>
      </div>
    </div>
  );
}
