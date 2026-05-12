"use client";

import { useState, useEffect, useId } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type {
  Easing,
  PresetCategory,
  PresetDefinition,
  PresetParam,
  PresetTrack,
  StoredPreset,
} from "@open-effects/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DraggableNumberInput } from "@/components/ui/draggable-number-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EasingEditor } from "./EasingEditor";

const CATEGORIES: PresetCategory[] = ["in", "out", "effect"];

const KNOWN_PROPERTIES = [
  "opacity",
  "transform.translateX",
  "transform.translateY",
  "transform.scale",
  "transform.rotate",
];

interface Props {
  open: boolean;
  onClose: () => void;
  preset: StoredPreset | null; // null → create mode
  onSaved: () => void;
}

function emptyDraft(): PresetDefinition {
  return {
    key: "",
    name: "",
    category: "in",
    iconKey: "fade",
    defaultDuration: 30,
    defaultEasing: { type: "ease-out" },
    params: [],
    animatedProperties: [],
    tracks: [
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "0" },
          { fraction: 1, value: "1" },
        ],
      },
    ],
  };
}

function draftFromStored(p: StoredPreset): PresetDefinition {
  return {
    key: p.key,
    name: p.name,
    category: p.category,
    iconKey: p.iconKey,
    defaultDuration: p.defaultDuration,
    defaultEasing: p.defaultEasing,
    params: p.params,
    animatedProperties: p.animatedProperties,
    tracks: p.tracks,
  };
}

export function PresetEditorModal({ open, onClose, preset, onSaved }: Props) {
  const formId = useId();
  const [draft, setDraft] = useState<PresetDefinition>(() =>
    preset ? draftFromStored(preset) : emptyDraft(),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(preset ? draftFromStored(preset) : emptyDraft());
    }
  }, [open, preset]);

  const isEditing = !!preset;
  const isBuiltIn = preset?.isBuiltIn === true;

  // ── handlers ────────────────────────────────────────────────────────────
  function patch(p: Partial<PresetDefinition>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function setParam(index: number, next: PresetParam) {
    setDraft((d) => {
      const params = [...d.params];
      params[index] = next;
      return { ...d, params };
    });
  }

  function addParam() {
    setDraft((d) => ({
      ...d,
      params: [
        ...d.params,
        { kind: "number", key: `param${d.params.length + 1}`, label: "Param", default: 0 },
      ],
    }));
  }

  function removeParam(index: number) {
    setDraft((d) => ({ ...d, params: d.params.filter((_, i) => i !== index) }));
  }

  function setTrack(index: number, next: PresetTrack) {
    setDraft((d) => {
      const tracks = [...d.tracks];
      tracks[index] = next;
      return { ...d, tracks };
    });
  }

  function addTrack() {
    setDraft((d) => ({
      ...d,
      tracks: [
        ...d.tracks,
        {
          property: "opacity",
          stops: [
            { fraction: 0, value: "0" },
            { fraction: 1, value: "1" },
          ],
        },
      ],
    }));
  }

  function removeTrack(index: number) {
    setDraft((d) => ({ ...d, tracks: d.tracks.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!draft.key.trim() || !draft.name.trim()) {
      toast.error("Key and Name are required");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(draft.key)) {
      toast.error("Key must be kebab-case (a-z, 0-9, hyphen)");
      return;
    }
    if (draft.tracks.length === 0) {
      toast.error("At least one track is required");
      return;
    }
    setSaving(true);
    try {
      const res = isEditing
        ? await fetch(`/api/presets/${preset!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
          })
        : await fetch(`/api/presets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code =
          data?.error === "key_already_exists"
            ? "A preset with that key already exists"
            : `Save failed (HTTP ${res.status})`;
        toast.error(code);
        return;
      }
      toast.success(isEditing ? "Preset updated" : "Preset created");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!preset) return;
    if (!confirm(`Delete preset "${preset.name}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/presets/${preset.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(`Delete failed (HTTP ${res.status})`);
        return;
      }
      toast.success("Preset deleted");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit preset — ${preset!.name}` : "New preset"}
          </DialogTitle>
        </DialogHeader>

        <div
          className="grid grid-cols-2 gap-4 overflow-y-auto pr-1"
          style={{ maxHeight: "calc(85vh - 8rem)" }}
        >
          {/* ── Left column: identity ─────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${formId}-key`} className="text-xs">
                Key (stable id, kebab-case)
              </Label>
              <Input
                id={`${formId}-key`}
                value={draft.key}
                disabled={isBuiltIn}
                onChange={(e) => patch({ key: e.target.value })}
                className="h-8 text-xs"
                placeholder="my-fancy-preset"
              />
              {isBuiltIn && (
                <span className="text-[10px] text-muted-foreground">
                  Built-in keys cannot be changed.
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor={`${formId}-name`} className="text-xs">
                Name
              </Label>
              <Input
                id={`${formId}-name`}
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Category</Label>
              <select
                value={draft.category}
                onChange={(e) =>
                  patch({ category: e.target.value as PresetCategory })
                }
                className="h-8 rounded-md border bg-background px-2 text-xs"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor={`${formId}-icon`} className="text-xs">
                Icon key (lucide)
              </Label>
              <Input
                id={`${formId}-icon`}
                value={draft.iconKey}
                onChange={(e) => patch({ iconKey: e.target.value })}
                className="h-8 text-xs"
                placeholder="sparkles"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Default duration (frames)</Label>
              <DraggableNumberInput
                min={1}
                className="h-8 text-xs"
                value={draft.defaultDuration}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1) patch({ defaultDuration: v });
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Default easing</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-full justify-start px-2 text-xs"
                  >
                    {draft.defaultEasing.type}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <EasingEditor
                    easing={draft.defaultEasing}
                    onSave={(e: Easing) => patch({ defaultEasing: e })}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">
                Animated properties (comma-separated)
              </Label>
              <Input
                value={draft.animatedProperties.join(", ")}
                onChange={(e) =>
                  patch({
                    animatedProperties: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="h-8 text-xs"
                placeholder="opacity, transform.translateX"
              />
              <span className="text-[10px] text-muted-foreground">
                Known: {KNOWN_PROPERTIES.join(", ")}
              </span>
            </div>

            {/* Params */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Parameters</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={addParam}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              </div>
              {draft.params.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  No parameters.
                </p>
              )}
              {draft.params.map((p, i) => (
                <ParamRow
                  key={i}
                  param={p}
                  onChange={(next) => setParam(i, next)}
                  onRemove={() => removeParam(i)}
                />
              ))}
            </div>
          </div>

          {/* ── Right column: tracks ──────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Tracks (keyframe blueprint)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={addTrack}
              >
                <Plus className="mr-1 h-3 w-3" /> Add track
              </Button>
            </div>
            {draft.tracks.map((t, i) => (
              <TrackRow
                key={i}
                track={t}
                onChange={(next) => setTrack(i, next)}
                onRemove={() => removeTrack(i)}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
          <div>
            {isEditing && !isBuiltIn && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={saving}
              >
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Param row
// ───────────────────────────────────────────────────────────────────────────

interface ParamRowProps {
  param: PresetParam;
  onChange: (next: PresetParam) => void;
  onRemove: () => void;
}

function ParamRow({ param, onChange, onRemove }: ParamRowProps) {
  return (
    <div className="flex flex-col gap-1 rounded border border-border bg-muted/30 p-2">
      <div className="flex items-center gap-1">
        <select
          value={param.kind}
          onChange={(e) => {
            const kind = e.target.value as "number" | "text";
            if (kind === "number") {
              onChange({
                kind: "number",
                key: param.key,
                label: param.label,
                default: typeof param.default === "number" ? param.default : 0,
              });
            } else {
              onChange({
                kind: "text",
                key: param.key,
                label: param.label,
                default: String(param.default ?? ""),
              });
            }
          }}
          className="h-7 rounded border bg-background px-1 text-[11px]"
        >
          <option value="number">number</option>
          <option value="text">text</option>
        </select>
        <Input
          value={param.key}
          onChange={(e) => onChange({ ...param, key: e.target.value })}
          className="h-7 text-[11px]"
          placeholder="key"
        />
        <Input
          value={param.label}
          onChange={(e) => onChange({ ...param, label: e.target.value })}
          className="h-7 text-[11px]"
          placeholder="Label"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={onRemove}
          aria-label="Remove parameter"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        {param.kind === "number" ? (
          <>
            <DraggableNumberInput
              className="h-7 text-[11px]"
              value={param.default}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onChange({ ...param, default: v });
              }}
            />
            <Input
              value={param.unit ?? ""}
              onChange={(e) =>
                onChange({ ...param, unit: e.target.value || undefined })
              }
              className="h-7 w-16 text-[11px]"
              placeholder="unit"
            />
            <Input
              type="number"
              value={param.min ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                onChange({ ...param, min: v });
              }}
              className="h-7 w-16 text-[11px]"
              placeholder="min"
            />
            <Input
              type="number"
              value={param.max ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                onChange({ ...param, max: v });
              }}
              className="h-7 w-16 text-[11px]"
              placeholder="max"
            />
          </>
        ) : (
          <Input
            value={String(param.default)}
            onChange={(e) => onChange({ ...param, default: e.target.value })}
            className="h-7 text-[11px]"
            placeholder="default value"
          />
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Track row
// ───────────────────────────────────────────────────────────────────────────

interface TrackRowProps {
  track: PresetTrack;
  onChange: (next: PresetTrack) => void;
  onRemove: () => void;
}

function TrackRow({ track, onChange, onRemove }: TrackRowProps) {
  function setProperty(p: string) {
    onChange({ ...track, property: p });
  }

  function setStop(i: number, frac: number, value: string) {
    const stops = [...track.stops];
    stops[i] = { fraction: frac, value };
    onChange({ ...track, stops });
  }

  function addStop() {
    const last = track.stops[track.stops.length - 1];
    onChange({
      ...track,
      stops: [...track.stops, { fraction: last?.fraction ?? 1, value: "0" }],
    });
  }

  function removeStop(i: number) {
    if (track.stops.length <= 2) return; // need at least 2 stops
    onChange({ ...track, stops: track.stops.filter((_, j) => j !== i) });
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-muted/30 p-2">
      <div className="flex items-center gap-1">
        <Input
          value={track.property}
          onChange={(e) => setProperty(e.target.value)}
          className="h-7 flex-1 text-[11px]"
          placeholder="property (e.g. opacity)"
          list="preset-known-props"
        />
        <datalist id="preset-known-props">
          {KNOWN_PROPERTIES.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={onRemove}
          aria-label="Remove track"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        {track.stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-12 text-[10px] text-muted-foreground">
              frac
            </span>
            <DraggableNumberInput
              min={0}
              max={1}
              step={0.01}
              className="h-7 w-16 text-[11px]"
              value={stop.fraction}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) setStop(i, Math.max(0, Math.min(1, v)), stop.value);
              }}
            />
            <Input
              value={stop.value}
              onChange={(e) => setStop(i, stop.fraction, e.target.value)}
              className="h-7 flex-1 text-[11px]"
              placeholder='e.g. "${fromOpacity}" or "0px"'
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={() => removeStop(i)}
              disabled={track.stops.length <= 2}
              aria-label="Remove stop"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 self-start px-2 text-[10px]"
          onClick={addStop}
        >
          <Plus className="mr-1 h-3 w-3" /> Add stop
        </Button>
      </div>
    </div>
  );
}
