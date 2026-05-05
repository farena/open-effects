"use client";

import type { AudioTrack, Eq } from "@open-effects/shared-types";
import { useEditorStore } from "@/editor/store";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EQ_BANDS: { key: keyof Eq; label: string; freq: string }[] = [
  { key: "low", label: "Low", freq: "80 Hz" },
  { key: "mid", label: "Mid", freq: "1 kHz" },
  { key: "high", label: "High", freq: "5 kHz" },
  { key: "presence", label: "Presence", freq: "10 kHz" },
];

const EQ_MIN = -12;
const EQ_MAX = 12;
const EQ_STEP = 0.5;

function defaultEq(): Eq {
  return { low: 0, mid: 0, high: 0, presence: 0 };
}

function isAllZero(eq: Eq): boolean {
  return eq.low === 0 && eq.mid === 0 && eq.high === 0 && eq.presence === 0;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EqEditorProps {
  track: AudioTrack;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EqEditor({ track }: EqEditorProps) {
  const setAudioTrackEq = useEditorStore((s) => s.setAudioTrackEq);

  const eq: Eq = track.eq ?? defaultEq();

  function handleBandChange(key: keyof Eq, value: number) {
    const next: Eq = { ...eq, [key]: value };
    if (isAllZero(next)) {
      setAudioTrackEq(track.id, null);
    } else {
      setAudioTrackEq(track.id, next);
    }
  }

  function handleReset() {
    setAudioTrackEq(track.id, null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          EQ
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={handleReset}
        >
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {EQ_BANDS.map(({ key, label, freq }) => {
          const value = eq[key];
          return (
            <div key={key} className="flex flex-col items-center gap-1.5">
              <Label className="text-center text-xs font-medium">{label}</Label>
              <span className="text-center text-xs text-muted-foreground">
                {freq}
              </span>
              {/* Vertical slider — rendered rotated for a vertical feel */}
              <div className="flex h-24 items-center justify-center">
                <Slider
                  orientation="vertical"
                  min={EQ_MIN}
                  max={EQ_MAX}
                  step={EQ_STEP}
                  value={[value]}
                  onValueChange={([v]) => handleBandChange(key, v)}
                  className="h-full"
                  aria-label={`${label} EQ gain`}
                />
              </div>
              <span className="tabular-nums text-xs text-muted-foreground">
                {value > 0 ? `+${value}` : value} dB
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        EQ applied at render only — not audible in preview.
      </p>
    </div>
  );
}
