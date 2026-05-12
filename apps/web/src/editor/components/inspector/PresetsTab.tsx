"use client";

import { useMemo, useState } from "react";
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
  ChevronLeft,
  Plus,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import type { Layer, StoredPreset } from "@open-effects/shared-types";
import type { Easing } from "@open-effects/shared-types";
import type { AnimationPreset, PresetCategory } from "@/editor/presets/types";
import { detectPresetConflicts } from "@/editor/presets/detect-conflicts";
import { resolveAnchor } from "@/editor/presets/build-keyframes";
import { animationPresetFromDefinition } from "@/editor/presets/from-definition";
import { usePresets } from "@/editor/presets/use-presets";
import { EasingEditor } from "./EasingEditor";
import { PresetPreviewModal } from "./PresetPreviewModal";
import { PresetEditorModal } from "./PresetEditorModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DraggableNumberInput } from "@/components/ui/draggable-number-input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEditorStore } from "@/editor/store";
import { LoadingSkeleton, ErrorBlock } from "@/components/ui/feedback";

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
// Configuration view
// ---------------------------------------------------------------------------

interface ConfigViewProps {
  layer: Layer;
  preset: AnimationPreset;
  onBack: () => void;
}

function ConfigView({ layer, preset, onBack }: ConfigViewProps) {
  const applyAnimationPresetToLayer = useEditorStore(
    (s) => s.applyAnimationPresetToLayer,
  );

  const [duration, setDuration] = useState<number>(preset.defaultDuration);
  const [easing, setEasing] = useState<Easing>(preset.defaultEasing);

  const [values, setValues] = useState<Record<string, number | string>>(() => {
    const init: Record<string, number | string> = {};
    for (const param of preset.params) {
      init[param.key] = param.default;
    }
    return init;
  });

  const midpoint = Math.floor((layer.startFrame + layer.endFrame) / 2);
  const [anchorFrame, setAnchorFrame] = useState<number>(midpoint);

  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const layerLength = layer.endFrame - layer.startFrame;
  const durationClamped = duration > layerLength;
  const springShortWarning = easing.type === "spring" && duration < 15;

  const ctxAnchor = preset.category === "effect" ? anchorFrame : -1;
  const clampedDur = Math.min(duration, layerLength);
  const resolvedAnchor = resolveAnchor(
    preset,
    { layer, duration: clampedDur, easing, anchorFrame: ctxAnchor, values },
    clampedDur,
  );
  const conflicts = detectPresetConflicts(layer, preset, {
    layer,
    duration,
    easing,
    anchorFrame: resolvedAnchor,
    values,
  });

  function handleApply() {
    if (conflicts.length > 0) {
      setConflictDialogOpen(true);
    } else {
      applyAnimationPresetToLayer(layer.id, preset, {
        duration,
        easing,
        values,
        anchorFrame: preset.category === "effect" ? anchorFrame : undefined,
        replaceConflicts: false,
      });
      onBack();
    }
  }

  function handleConflictReplace() {
    applyAnimationPresetToLayer(layer.id, preset, {
      duration,
      easing,
      values,
      anchorFrame: preset.category === "effect" ? anchorFrame : undefined,
      replaceConflicts: true,
    });
    setConflictDialogOpen(false);
    onBack();
  }

  function handleConflictKeepBoth() {
    applyAnimationPresetToLayer(layer.id, preset, {
      duration,
      easing,
      values,
      anchorFrame: preset.category === "effect" ? anchorFrame : undefined,
      replaceConflicts: false,
    });
    setConflictDialogOpen(false);
    onBack();
  }

  function handleConflictCancel() {
    setConflictDialogOpen(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={onBack}
          aria-label="Back to catalog"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="truncate text-xs font-medium">{preset.name}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            Duration (frames)
          </Label>
          <DraggableNumberInput
            min={1}
            className="h-8 text-xs"
            value={duration}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1) setDuration(v);
            }}
          />
          {durationClamped && (
            <p className="text-xs text-amber-500">
              Duration clamped to layer length ({layerLength} frames).
            </p>
          )}
          {springShortWarning && (
            <p className="text-xs text-blue-400">
              Spring may not be visible at this duration.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Easing</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-full justify-start px-2 text-xs"
              >
                {easing.type}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <EasingEditor easing={easing} onSave={setEasing} />
            </PopoverContent>
          </Popover>
        </div>

        {preset.params.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Parameters</Label>
            {preset.params.map((param) => (
              <div key={param.key} className="flex flex-col gap-0.5">
                <Label className="text-xs">{param.label}</Label>
                {param.kind === "number" ? (
                  <DraggableNumberInput
                    className="h-8 text-xs"
                    value={values[param.key] ?? param.default}
                    min={param.min}
                    max={param.max}
                    onChange={(e) => {
                      const parsed = parseFloat(e.target.value);
                      if (!isNaN(parsed)) {
                        setValues((prev) => ({ ...prev, [param.key]: parsed }));
                      }
                    }}
                  />
                ) : (
                  <Input
                    type="text"
                    className="h-8 text-xs"
                    value={values[param.key] ?? param.default}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [param.key]: e.target.value,
                      }))
                    }
                  />
                )}
                {param.kind === "number" && param.unit && (
                  <span className="text-xs text-muted-foreground">
                    Unit: {param.unit}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {preset.category === "effect" && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              Anchor frame
            </Label>
            <DraggableNumberInput
              min={layer.startFrame}
              max={layer.endFrame}
              className="h-8 text-xs"
              value={anchorFrame}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setAnchorFrame(v);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Default: midpoint of layer ({midpoint})
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => setPreviewOpen(true)}
          >
            Preview
          </Button>
          <Button size="sm" className="flex-1" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>

      <PresetPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        layer={layer}
        preset={preset}
        duration={duration}
        easing={easing}
        values={values}
        anchorFrame={anchorFrame}
      />

      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conflicting keyframes</DialogTitle>
            <DialogDescription>
              The preset &quot;{preset.name}&quot; overlaps existing keyframes
              on {conflicts.map((c) => c.property).join(", ")}. How would you
              like to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConflictCancel}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleConflictKeepBoth}
            >
              Keep both
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConflictReplace}
            >
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catalog view
// ---------------------------------------------------------------------------

interface CatalogViewProps {
  category: PresetCategory;
  onCategoryChange: (c: PresetCategory) => void;
  onSelect: (stored: StoredPreset) => void;
  onEdit: (stored: StoredPreset) => void;
  onCreate: () => void;
  stored: StoredPreset[];
  isLoading: boolean;
  error: string | null;
}

function CatalogView({
  category,
  onCategoryChange,
  onSelect,
  onEdit,
  onCreate,
  stored,
  isLoading,
  error,
}: CatalogViewProps) {
  const filtered = stored.filter((p) => p.category === category);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Presets
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={onCreate}
        >
          <Plus className="mr-1 h-3 w-3" /> New
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div className="flex gap-1">
          {CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onCategoryChange(value)}
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

        {isLoading && <LoadingSkeleton />}
        {error && <ErrorBlock message={error} />}

        {!isLoading && !error && (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((preset) => {
              const Icon = resolveIcon(preset.iconKey);
              return (
                <div key={preset.id} className="group relative">
                  <button
                    onClick={() => onSelect(preset)}
                    className="flex w-full flex-col items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-3 text-center transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-xs font-medium leading-tight">
                      {preset.name}
                    </span>
                    {!preset.isBuiltIn && (
                      <span className="text-[9px] uppercase text-muted-foreground">
                        custom
                      </span>
                    )}
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${preset.name}`}
                    className="absolute right-1 top-1 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(preset);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-2 text-center text-xs text-muted-foreground">
                No presets in this category.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PresetsTab({ layer }: { layer: Layer }) {
  const [category, setCategory] = useState<PresetCategory>("in");
  const [selectedStored, setSelectedStored] = useState<StoredPreset | null>(
    null,
  );
  const [editingPreset, setEditingPreset] = useState<StoredPreset | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const { presets, isLoading, error, refresh } = usePresets();

  const runtimePreset = useMemo<AnimationPreset | null>(() => {
    if (!selectedStored) return null;
    return animationPresetFromDefinition(selectedStored);
  }, [selectedStored]);

  if (runtimePreset && selectedStored) {
    return (
      <ConfigView
        layer={layer}
        preset={runtimePreset}
        onBack={() => setSelectedStored(null)}
      />
    );
  }

  return (
    <>
      <CatalogView
        category={category}
        onCategoryChange={setCategory}
        onSelect={setSelectedStored}
        onEdit={(p) => {
          setEditingPreset(p);
          setEditorOpen(true);
        }}
        onCreate={() => {
          setEditingPreset(null);
          setEditorOpen(true);
        }}
        stored={presets}
        isLoading={isLoading}
        error={error}
      />
      <PresetEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        preset={editingPreset}
        onSaved={() => {
          refresh();
        }}
      />
    </>
  );
}
