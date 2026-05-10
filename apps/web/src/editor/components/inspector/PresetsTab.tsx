"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Zap,
  RotateCw,
  RotateCcw,
  ChevronsUp,
  Activity,
  Heart,
  Wind,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minimize2,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { Layer } from "@open-effects/shared-types";
import { ANIMATION_PRESETS } from "@/editor/presets/animation-presets";
import type { AnimationPreset, PresetCategory } from "@/editor/presets/types";

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  fade: Eye,
  "eye-off": EyeOff,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  "arrow-down": ArrowDown,
  maximize: Maximize2,
  minimize: Minimize2,
  zap: Zap,
  "rotate-cw": RotateCw,
  "rotate-ccw": RotateCcw,
  "chevrons-up": ChevronsUp,
  activity: Activity,
  heart: Heart,
  wind: Wind,
  star: Star,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  "refresh-cw": RotateCw,
};

function resolveIcon(iconKey: string): LucideIcon {
  return ICON_MAP[iconKey] ?? Sparkles;
}

// ---------------------------------------------------------------------------
// Category chip selector
// ---------------------------------------------------------------------------

const CATEGORIES: { value: PresetCategory; label: string }[] = [
  { value: "in", label: "IN" },
  { value: "out", label: "OUT" },
  { value: "effect", label: "EFFECT" },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PresetsTab({ layer }: { layer: Layer }) {
  const [category, setCategory] = useState<PresetCategory>("in");
  // selectedPreset state — Task 9 renders the configuration view
  const [selectedPreset, setSelectedPreset] =
    useState<AnimationPreset | null>(null);

  // Task 9 will replace this stub with the configuration panel
  if (selectedPreset) {
    // layer will be forwarded to ConfigView in Task 9
    void layer;
    return null;
  }

  const filtered = ANIMATION_PRESETS.filter((p) => p.category === category);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Presets
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {/* Category chip selector */}
        <div className="flex gap-1">
          {CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={[
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                value === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 2-column card grid */}
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((preset) => {
            const Icon = resolveIcon(preset.iconKey);
            return (
              <button
                key={preset.key}
                onClick={() => setSelectedPreset(preset)}
                className="flex flex-col items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-3 text-center transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium leading-tight">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
