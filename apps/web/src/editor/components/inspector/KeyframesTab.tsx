"use client";

import { useState } from "react";
import { useEditorStore } from "@/editor/store";
import {
  selectActiveLayer,
  selectAnimatedProperties,
  selectKeyframesForProperty,
} from "@/editor/selectors";
import { PROPERTIES } from "@open-effects/runtime";
import type { Keyframe } from "@open-effects/shared-types";
import { PropertyPicker } from "./PropertyPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { EasingEditor } from "./EasingEditor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick a starting value for a new keyframe using the "closest prior keyframe" heuristic. */
function resolveInitialValue(
  keyframes: Keyframe[],
  property: string,
  currentFrame: number
): string {
  if (keyframes.length === 0) {
    return PROPERTIES[property]?.defaultValue ?? "0";
  }

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

  // Closest keyframe at or before currentFrame
  const prior = [...sorted].reverse().find((k) => k.frame <= currentFrame);
  if (prior) return prior.value;

  // Fall back to closest keyframe after currentFrame
  const next = sorted.find((k) => k.frame > currentFrame);
  if (next) return next.value;

  return PROPERTIES[property]?.defaultValue ?? "0";
}

/** Format an easing type to a human-readable label for the placeholder button. */
function easingLabel(kf: Keyframe): string {
  const t = kf.easingOut.type;
  return t;
}

/** Convert rgba/rgb string to a hex color for <input type="color">. Returns #000000 on failure. */
function colorToHex(value: string): string {
  const m = value.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
  );
  if (!m) return "#000000";
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  return (
    "#" +
    [r, g, b]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Convert a hex color string to rgba with full opacity. */
function hexToRgba(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},1)`;
}

// ---------------------------------------------------------------------------
// Sub-component: a single keyframe row
// ---------------------------------------------------------------------------

interface KeyframeRowProps {
  layerId: string;
  property: string;
  keyframe: Keyframe;
}

function KeyframeRow({ layerId, property, keyframe }: KeyframeRowProps) {
  const moveKeyframe = useEditorStore((s) => s.moveKeyframe);
  const updateKeyframeValue = useEditorStore((s) => s.updateKeyframeValue);
  const updateKeyframeEasing = useEditorStore((s) => s.updateKeyframeEasing);
  const deleteKeyframe = useEditorStore((s) => s.deleteKeyframe);

  const [frameInput, setFrameInput] = useState(String(keyframe.frame));

  const meta = PROPERTIES[property];
  const isColor = meta?.type === "color";
  const suffix =
    meta?.type === "length-px"
      ? "px"
      : meta?.type === "angle-deg"
      ? "deg"
      : null;

  // Sync frameInput when keyframe.frame changes externally (e.g. move rejected)
  if (frameInput !== String(keyframe.frame) && document.activeElement?.id !== `frame-${keyframe.id ?? keyframe.frame}-${property}`) {
    // Only reset when the field is not focused
  }

  function handleFrameBlur() {
    const parsed = parseInt(frameInput, 10);
    if (isNaN(parsed) || parsed < 0) {
      setFrameInput(String(keyframe.frame));
      return;
    }
    if (parsed !== keyframe.frame) {
      moveKeyframe(layerId, property, keyframe.frame, parsed);
      // Store may reject (collision); re-read will happen on next render via store
    }
    // Reset to current store value to pick up any collision snap-back
    setFrameInput(String(keyframe.frame));
  }

  function handleValueBlur(newValue: string) {
    if (newValue !== keyframe.value) {
      updateKeyframeValue(layerId, property, keyframe.frame, newValue);
    }
  }

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Frame number */}
      <div className="flex flex-col gap-0.5 w-16 shrink-0">
        <Label className="text-xs text-muted-foreground">Frame</Label>
        <Input
          id={`frame-${keyframe.id ?? keyframe.frame}-${property}`}
          type="number"
          min={0}
          className="h-7 text-xs px-1.5"
          value={frameInput}
          onChange={(e) => setFrameInput(e.target.value)}
          onBlur={handleFrameBlur}
        />
      </div>

      {/* Value */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <Label className="text-xs text-muted-foreground">Value</Label>
        {isColor ? (
          <input
            type="color"
            className="h-7 w-full rounded-md border border-input bg-background cursor-pointer"
            value={colorToHex(keyframe.value)}
            onChange={(e) => {
              // onChange fires on every pick; blur fires on close — update on change
              handleValueBlur(hexToRgba(e.target.value));
            }}
          />
        ) : (
          <div className="flex items-center gap-1">
            <Input
              type="text"
              className="h-7 text-xs px-1.5"
              defaultValue={keyframe.value}
              key={`${keyframe.frame}-${keyframe.value}`}
              onBlur={(e) => handleValueBlur(e.target.value)}
            />
            {suffix && (
              <span className="text-xs text-muted-foreground shrink-0">
                {suffix}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Easing button — opens EasingEditor popover */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <Label className="text-xs text-muted-foreground">Easing</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              data-testid="easing-button"
            >
              {easingLabel(keyframe)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <EasingEditor
              easing={keyframe.easingOut}
              onSave={(next) =>
                updateKeyframeEasing(layerId, property, keyframe.frame, next)
              }
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Delete */}
      <div className="flex flex-col gap-0.5 shrink-0 mt-4">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => deleteKeyframe(layerId, property, keyframe.frame)}
          aria-label="Delete keyframe"
        >
          <span className="text-sm leading-none">x</span>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: animated property block
// ---------------------------------------------------------------------------

interface AnimatedPropertyBlockProps {
  layerId: string;
  property: string;
  currentFrame: number;
}

function AnimatedPropertyBlock({
  layerId,
  property,
  currentFrame,
}: AnimatedPropertyBlockProps) {
  const keyframes = useEditorStore(selectKeyframesForProperty(property));
  const addKeyframe = useEditorStore((s) => s.addKeyframe);

  const meta = PROPERTIES[property];
  if (!meta) return null;

  function handleAddKeyframeHere() {
    const value = resolveInitialValue(keyframes, property, currentFrame);
    addKeyframe(layerId, property, currentFrame, value);
  }

  return (
    <details open className="border border-border rounded-md overflow-hidden mb-3">
      <summary className="px-3 py-2 text-sm font-medium cursor-pointer select-none bg-muted/40 hover:bg-muted/70 flex items-center justify-between">
        <span>{meta.label}</span>
        <span className="text-xs text-muted-foreground">{keyframes.length} kf</span>
      </summary>
      <div className="px-3 pb-2">
        {keyframes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No keyframes yet.</p>
        ) : (
          keyframes.map((kf) => (
            <KeyframeRow
              key={`${kf.frame}-${kf.property}`}
              layerId={layerId}
              property={property}
              keyframe={kf}
            />
          ))
        )}
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 h-7 text-xs w-full justify-start"
          onClick={handleAddKeyframeHere}
        >
          + keyframe at frame {currentFrame}
        </Button>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function KeyframesTab() {
  const layer = useEditorStore(selectActiveLayer);
  const animatedProperties = useEditorStore(selectAnimatedProperties);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const addKeyframe = useEditorStore((s) => s.addKeyframe);

  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);

  if (!layer) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Select a layer to manage keyframes.</div>
    );
  }

  function handleAddKeyframe() {
    if (!selectedProperty || !layer) return;

    const kfs = layer.keyframes.filter((k) => k.property === selectedProperty);
    const value = resolveInitialValue(kfs, selectedProperty, currentFrame);
    addKeyframe(layer.id, selectedProperty, currentFrame, value);
  }

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto">
      {/* Header: property picker + add button */}
      <div className="flex items-end gap-2">
        <PropertyPicker
          value={selectedProperty}
          onChange={setSelectedProperty}
          excludedKeys={animatedProperties}
        />
        <Button
          size="sm"
          disabled={!selectedProperty}
          onClick={handleAddKeyframe}
          className="shrink-0"
        >
          + Add keyframe
        </Button>
      </div>

      {/* Animated properties list */}
      {animatedProperties.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No animated properties yet. Pick a property above and add a keyframe.
        </p>
      ) : (
        <div className="flex flex-col">
          {animatedProperties.map((prop) => (
            <AnimatedPropertyBlock
              key={prop}
              layerId={layer.id}
              property={prop}
              currentFrame={currentFrame}
            />
          ))}
        </div>
      )}
    </div>
  );
}
