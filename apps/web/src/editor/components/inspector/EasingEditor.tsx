"use client";

import * as React from "react";
import { useState } from "react";
import type { Easing } from "@open-effects/shared-types";
import { evalEasing } from "@open-effects/runtime";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PopoverClose } from "@/components/ui/popover";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EasingType = Easing["type"];

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "ease-in", label: "Ease In" },
  { value: "ease-out", label: "Ease Out" },
  { value: "ease-in-out", label: "Ease In-Out" },
  { value: "cubic-bezier", label: "Cubic Bezier" },
  { value: "spring", label: "Spring" },
];

// ---------------------------------------------------------------------------
// Default params when switching to a parameterised type
// ---------------------------------------------------------------------------

const DEFAULT_CUBIC_BEZIER_PARAMS: [number, number, number, number] = [
  0.25, 0.1, 0.25, 1,
];

const DEFAULT_SPRING_PARAMS = { damping: 12, stiffness: 100, mass: 1 };

function defaultEasingForType(type: EasingType): Easing {
  switch (type) {
    case "cubic-bezier":
      return { type: "cubic-bezier", params: [...DEFAULT_CUBIC_BEZIER_PARAMS] };
    case "spring":
      return { type: "spring", params: { ...DEFAULT_SPRING_PARAMS } };
    default:
      return { type } as Easing;
  }
}

// ---------------------------------------------------------------------------
// Curve preview SVG
// ---------------------------------------------------------------------------

const PREVIEW_WIDTH = 180;
const PREVIEW_HEIGHT = 60;
const SAMPLE_COUNT = 100;
// Map y values 0..1 into the range [PREVIEW_HEIGHT - MARGIN, MARGIN] so
// overshoot (spring) goes above the box (overflow="visible").
const MARGIN = 5;
const Y_RANGE = PREVIEW_HEIGHT - MARGIN * 2;

function CurvePreview({ easing }: { easing: Easing }) {
  const points = React.useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const t = i / (SAMPLE_COUNT - 1);
      const y = evalEasing(easing, t * 30, 30, 30);
      const svgX = t * PREVIEW_WIDTH;
      // y=0 → bottom (PREVIEW_HEIGHT - MARGIN), y=1 → top (MARGIN)
      const svgY = PREVIEW_HEIGHT - MARGIN - y * Y_RANGE;
      pts.push(`${svgX.toFixed(2)},${svgY.toFixed(2)}`);
    }
    return pts.join(" ");
  }, [easing]);

  return (
    <svg
      width={PREVIEW_WIDTH}
      height={PREVIEW_HEIGHT}
      overflow="visible"
      className="block mx-auto my-2"
      aria-hidden="true"
    >
      {/* Axis lines */}
      <line
        x1={0}
        y1={PREVIEW_HEIGHT - MARGIN}
        x2={PREVIEW_WIDTH}
        y2={PREVIEW_HEIGHT - MARGIN}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />
      <line
        x1={0}
        y1={MARGIN}
        x2={PREVIEW_WIDTH}
        y2={MARGIN}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />
      {/* Curve */}
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface EasingEditorProps {
  easing: Easing;
  onSave: (next: Easing) => void;
}

export function EasingEditor({ easing, onSave }: EasingEditorProps) {
  const [draft, setDraft] = useState<Easing>(easing);

  function handleTypeChange(value: string) {
    const type = value as EasingType;
    if (type === draft.type) return;
    setDraft(defaultEasingForType(type));
  }

  function handleCubicParam(index: 0 | 1 | 2 | 3, raw: string) {
    if (draft.type !== "cubic-bezier") return;
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    const params = [...draft.params] as [number, number, number, number];
    params[index] = num;
    setDraft({ type: "cubic-bezier", params });
  }

  function handleSpringParam(
    key: "damping" | "stiffness" | "mass",
    raw: string
  ) {
    if (draft.type !== "spring") return;
    const num = parseFloat(raw);
    if (isNaN(num) || num <= 0) return;
    setDraft({ type: "spring", params: { ...draft.params, [key]: num } });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Type selector */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Easing type</Label>
        <Select value={draft.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EASING_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cubic-bezier params */}
      {draft.type === "cubic-bezier" && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            Handles (x1, y1, x2, y2)
          </Label>
          <div className="grid grid-cols-4 gap-1">
            {(["x1", "y1", "x2", "y2"] as const).map((label, i) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground text-center">
                  {label}
                </span>
                <Input
                  type="number"
                  step={0.01}
                  className="h-7 text-xs px-1 text-center"
                  value={draft.params[i as 0 | 1 | 2 | 3]}
                  onChange={(e) =>
                    handleCubicParam(i as 0 | 1 | 2 | 3, e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spring params */}
      {draft.type === "spring" && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Spring params</Label>
          <div className="grid grid-cols-3 gap-1">
            {(
              ["damping", "stiffness", "mass"] as Array<
                "damping" | "stiffness" | "mass"
              >
            ).map((key) => (
              <div key={key} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground text-center capitalize">
                  {key}
                </span>
                <Input
                  type="number"
                  step={key === "mass" ? 0.1 : 1}
                  min={0.01}
                  className="h-7 text-xs px-1 text-center"
                  value={draft.params[key]}
                  onChange={(e) => handleSpringParam(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Curve preview */}
      <CurvePreview easing={draft} />

      {/* Save */}
      <PopoverClose asChild>
        <Button
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => onSave(draft)}
        >
          Save
        </Button>
      </PopoverClose>
    </div>
  );
}
