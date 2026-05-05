"use client";

/**
 * Solid color, linear gradient (angle + color/alpha stops with %), or raw CSS
 * for scene backgrounds and similar `background` properties.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  buildGradient,
  buildSolid,
  type ColorStop,
  parseColorValue,
} from "./colorCss";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = "solid" | "gradient" | "css";

type StopRow = ColorStop & { id: string };

interface InternalState {
  mode: Mode;
  solidHex: string;
  solidAlpha: number;
  gradAngle: number;
  gradStops: StopRow[];
}

interface ColorPickerProps {
  value: string;
  onChange: (next: string) => void;
  id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let stopIdCounter = 0;
const nextStopId = () => `stop-${++stopIdCounter}`;

function stateFromValue(value: string): InternalState {
  const parsed = parseColorValue(value);
  if (parsed.kind === "solid") {
    return {
      mode: "solid",
      solidHex: parsed.hex,
      solidAlpha: parsed.alpha,
      gradAngle: 90,
      gradStops: [
        { id: nextStopId(), position: 0, hex: parsed.hex, alpha: parsed.alpha },
        { id: nextStopId(), position: 100, hex: "#ffffff", alpha: 1 },
      ],
    };
  }
  if (parsed.kind === "gradient") {
    return {
      mode: "gradient",
      solidHex: parsed.stops[0]?.hex ?? "#000000",
      solidAlpha: parsed.stops[0]?.alpha ?? 1,
      gradAngle: parsed.angle,
      gradStops: parsed.stops.map((s) => ({ ...s, id: nextStopId() })),
    };
  }
  return {
    mode: "css",
    solidHex: "#000000",
    solidAlpha: 1,
    gradAngle: 90,
    gradStops: [
      { id: nextStopId(), position: 0, hex: "#000000", alpha: 1 },
      { id: nextStopId(), position: 100, hex: "#ffffff", alpha: 1 },
    ],
  };
}

function stripStopIds(stops: StopRow[]): ColorStop[] {
  return stops.map((s) => ({
    position: s.position,
    hex: s.hex,
    alpha: s.alpha,
  }));
}

function buildCss(state: InternalState): string {
  if (state.mode === "solid") {
    return buildSolid(state.solidHex, state.solidAlpha);
  }
  return buildGradient(state.gradAngle, stripStopIds(state.gradStops));
}

function previewCss(state: InternalState): string {
  if (state.mode === "solid") {
    return buildSolid(state.solidHex, state.solidAlpha);
  }
  return buildGradient(state.gradAngle, stripStopIds(state.gradStops));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ColorPicker({ value, onChange, id }: ColorPickerProps) {
  const [state, setState] = useState<InternalState>(() =>
    stateFromValue(value),
  );
  const lastEmittedRef = useRef<string>(value);

  // Re-sync when the external value changes (e.g. switching scenes).
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    setState(stateFromValue(value));
    lastEmittedRef.current = value;
  }, [value]);

  function commit(next: InternalState) {
    setState(next);
    if (next.mode === "css") return;
    const css = buildCss(next);
    lastEmittedRef.current = css;
    onChange(css);
  }

  function setMode(mode: Mode) {
    if (mode === state.mode) return;
    if (mode === "css") {
      setState((s) => ({ ...s, mode: "css" }));
      return;
    }

    const parsed = parseColorValue(value);

    if (mode === "gradient") {
      if (parsed.kind === "gradient") {
        commit({ ...stateFromValue(value), mode: "gradient" });
        return;
      }
      if (parsed.kind === "solid") {
        commit({
          ...stateFromValue(value),
          mode: "gradient",
          gradStops: [
            {
              id: nextStopId(),
              position: 0,
              hex: parsed.hex,
              alpha: parsed.alpha,
            },
            { id: nextStopId(), position: 100, hex: "#ffffff", alpha: 1 },
          ],
        });
        return;
      }
      commit({
        ...stateFromValue(
          "linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(255,255,255,1) 100%)",
        ),
        mode: "gradient",
      });
      return;
    }

    // solid
    if (parsed.kind === "solid") {
      commit({ ...stateFromValue(value), mode: "solid" });
      return;
    }
    if (parsed.kind === "gradient") {
      const first = parsed.stops[0];
      commit({
        ...stateFromValue(value),
        mode: "solid",
        solidHex: first?.hex ?? "#000000",
        solidAlpha: first?.alpha ?? 1,
      });
      return;
    }
    commit({ ...stateFromValue("rgba(0,0,0,1)"), mode: "solid" });
  }

  // -------- Solid handlers --------

  function handleSolidHex(hex: string) {
    commit({ ...state, solidHex: hex });
  }
  function handleSolidAlpha(alpha: number) {
    commit({ ...state, solidAlpha: alpha });
  }

  // -------- Gradient handlers --------

  function handleAngle(angle: number) {
    commit({ ...state, gradAngle: angle });
  }

  function updateStop(id: string, patch: Partial<ColorStop>) {
    const gradStops = state.gradStops.map((s) =>
      s.id === id ? { ...s, ...patch } : s,
    );
    commit({ ...state, gradStops });
  }

  function deleteStop(id: string) {
    if (state.gradStops.length <= 2) return;
    commit({
      ...state,
      gradStops: state.gradStops.filter((s) => s.id !== id),
    });
  }

  function addStop() {
    const sorted = [...state.gradStops].sort((a, b) => a.position - b.position);
    let inserted: StopRow;
    if (sorted.length < 2) {
      inserted = {
        id: nextStopId(),
        position: 50,
        hex: "#888888",
        alpha: 1,
      };
    } else {
      // Find the largest gap and insert in the middle.
      let bestIdx = 0;
      let bestGap = -1;
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1]!.position - sorted[i]!.position;
        if (gap > bestGap) {
          bestGap = gap;
          bestIdx = i;
        }
      }
      const a = sorted[bestIdx]!;
      const b = sorted[bestIdx + 1]!;
      inserted = {
        id: nextStopId(),
        position: (a.position + b.position) / 2,
        hex: a.hex,
        alpha: (a.alpha + b.alpha) / 2,
      };
    }
    commit({
      ...state,
      gradStops: [...state.gradStops, inserted],
    });
  }

  // -------- Render --------

  return (
    <div className="flex flex-col gap-2" id={id}>
      {/* Mode toggle */}
      <div className="grid grid-cols-3 gap-0.5 rounded-md bg-muted p-0.5">
        <ModeButton
          active={state.mode === "solid"}
          onClick={() => setMode("solid")}
        >
          Solid
        </ModeButton>
        <ModeButton
          active={state.mode === "gradient"}
          onClick={() => setMode("gradient")}
        >
          Gradient
        </ModeButton>
        <ModeButton
          active={state.mode === "css"}
          onClick={() => setMode("css")}
        >
          CSS
        </ModeButton>
      </div>

      {state.mode !== "css" && (
        /* Preview bar (checkerboard underlay shows alpha) */
        <div
          className="h-8 w-full overflow-hidden rounded-md border border-input"
          style={{
            backgroundImage:
              "repeating-conic-gradient(#cbd5e1 0% 25%, #f8fafc 0% 50%)",
            backgroundSize: "12px 12px",
          }}
          aria-label="Color preview"
        >
          <div
            className="h-full w-full"
            style={{ background: previewCss(state) }}
          />
        </div>
      )}

      {state.mode === "solid" ? (
        <SolidEditor
          hex={state.solidHex}
          alpha={state.solidAlpha}
          onHex={handleSolidHex}
          onAlpha={handleSolidAlpha}
        />
      ) : state.mode === "gradient" ? (
        <GradientEditor
          angle={state.gradAngle}
          stops={state.gradStops}
          onAngle={handleAngle}
          onUpdateStop={updateStop}
          onDeleteStop={deleteStop}
          onAddStop={addStop}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Raw <code className="text-foreground">background</code> CSS (radial
            gradients, multiple layers, non-linear syntax, etc.).
          </p>
          <textarea
            className={cn(
              "min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground ring-offset-background",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
            spellCheck={false}
            value={value}
            onChange={(e) => {
              const next = e.target.value;
              lastEmittedRef.current = next;
              onChange(next);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors " +
        (active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function SolidEditor({
  hex,
  alpha,
  onHex,
  onAlpha,
}: {
  hex: string;
  alpha: number;
  onHex: (hex: string) => void;
  onAlpha: (alpha: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onHex(e.target.value)}
          className="h-8 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background"
          aria-label="Color"
        />
        <Input
          value={hex}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#([0-9a-fA-F]{6})$/.test(v)) onHex(v.toLowerCase());
          }}
          className="h-8 font-mono text-xs"
          aria-label="Hex value"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="w-12 shrink-0 text-xs text-muted-foreground">
          Alpha
        </Label>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[alpha]}
          onValueChange={(vals) => onAlpha(vals[0] ?? 1)}
          className="flex-1"
        />
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {alpha.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function GradientEditor({
  angle,
  stops,
  onAngle,
  onUpdateStop,
  onDeleteStop,
  onAddStop,
}: {
  angle: number;
  stops: StopRow[];
  onAngle: (angle: number) => void;
  onUpdateStop: (id: string, patch: Partial<ColorStop>) => void;
  onDeleteStop: (id: string) => void;
  onAddStop: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label className="w-12 shrink-0 text-xs text-muted-foreground">
          Angle
        </Label>
        <Input
          type="number"
          min={0}
          max={360}
          step={1}
          value={Math.round(angle)}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n)) onAngle(n);
          }}
          className="h-8 w-20 text-xs"
        />
        <span className="text-xs text-muted-foreground">deg</span>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Stops</Label>
        {stops.map((stop) => (
          <StopRowItem
            key={stop.id}
            stop={stop}
            canDelete={stops.length > 2}
            onUpdate={(patch) => onUpdateStop(stop.id, patch)}
            onDelete={() => onDeleteStop(stop.id)}
          />
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 h-7 justify-start text-xs"
          onClick={onAddStop}
        >
          + Add stop
        </Button>
      </div>
    </div>
  );
}

function StopRowItem({
  stop,
  canDelete,
  onUpdate,
  onDelete,
}: {
  stop: StopRow;
  canDelete: boolean;
  onUpdate: (patch: Partial<ColorStop>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={stop.hex}
        onChange={(e) => onUpdate({ hex: e.target.value })}
        className="h-7 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-background"
        aria-label="Stop color"
      />
      <Input
        type="number"
        min={0}
        max={100}
        step={1}
        value={Math.round(stop.position)}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onUpdate({ position: n });
        }}
        className="h-7 w-16 px-1.5 text-xs"
        aria-label="Stop position"
      />
      <span className="text-xs text-muted-foreground">%</span>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={[stop.alpha]}
        onValueChange={(vals) => onUpdate({ alpha: vals[0] ?? 1 })}
        className="flex-1"
        aria-label="Stop alpha"
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={onDelete}
        disabled={!canDelete}
        aria-label="Delete stop"
      >
        <span className="text-sm leading-none">x</span>
      </Button>
    </div>
  );
}
