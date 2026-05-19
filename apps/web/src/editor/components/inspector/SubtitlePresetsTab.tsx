"use client";

import { useState } from "react";
import {
  Captions,
  ArrowUpFromLine,
  Sparkle,
  type LucideIcon,
} from "lucide-react";
import type { SubtitleLayer } from "@open-effects/shared-types";
import { SUBTITLE_PRESETS } from "@/editor/presets/subtitles/registry";
import { useEditorStore } from "@/editor/store";
import { ConfirmDialog } from "@/editor/components/ConfirmDialog";

// ---------------------------------------------------------------------------
// Icon lookup for subtitle preset iconKey strings
// ---------------------------------------------------------------------------

const iconLookup: Record<string, LucideIcon> = {
  Captions,
  ArrowUpFromLine,
  Sparkle,
};

// ---------------------------------------------------------------------------
// SubtitlePresetsTab
// ---------------------------------------------------------------------------

interface SubtitlePresetsTabProps {
  layer: SubtitleLayer;
}

export function SubtitlePresetsTab({ layer }: SubtitlePresetsTabProps) {
  const setSubtitlePreset = useEditorStore((s) => s.setSubtitlePreset);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  function handlePresetClick(key: string) {
    if (layer.subtitle.manualOverride) {
      setPendingKey(key);
      setConfirmOpen(true);
    } else {
      setSubtitlePreset(layer.id, key);
    }
  }

  function handleConfirm() {
    if (pendingKey !== null) {
      setSubtitlePreset(layer.id, pendingKey);
      setPendingKey(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {SUBTITLE_PRESETS.map((preset) => {
          const isActive = preset.key === layer.subtitle.presetKey;
          const Icon = iconLookup[preset.iconKey] ?? Captions;
          return (
            <button
              key={preset.key}
              onClick={() => handlePresetClick(preset.key)}
              className={`flex w-full items-start gap-2 rounded border p-2 text-left text-xs ${
                isActive
                  ? "border-amber-500/60 bg-amber-900/20"
                  : "border-[#2d2d2d] hover:bg-[#2a2a2a]"
              }`}
            >
              <Icon className="size-4 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white">{preset.name}</div>
                <div className="text-[#888]">{preset.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPendingKey(null);
        }}
        title="Override manual edits?"
        description="You have manually edited this subtitle layer. Switching presets will regenerate the HTML and keyframes, discarding your changes. Continue?"
        confirmLabel="Switch preset"
        destructive
        onConfirm={handleConfirm}
      />
    </div>
  );
}
