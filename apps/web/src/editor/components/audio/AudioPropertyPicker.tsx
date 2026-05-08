"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Audio property registry
// ---------------------------------------------------------------------------
// This registry is the single source of truth for animatable audio properties.
// Adding pan/pitch later only requires adding entries here; the picker and
// AudioFxTab per-property block structure will render them automatically.

export const AUDIO_PROPERTIES = [
  { key: "volume", label: "Volume", min: 0, max: 1, default: 1 },
  // future: { key: "pan", label: "Pan", min: -1, max: 1, default: 0 },
  // future: { key: "pitch", label: "Pitch", min: -12, max: 12, default: 0 },
] as const;

export type AudioPropertyKey = (typeof AUDIO_PROPERTIES)[number]["key"];

// ---------------------------------------------------------------------------
// AudioPropertyPicker component
// ---------------------------------------------------------------------------

interface AudioPropertyPickerProps {
  value: AudioPropertyKey | null;
  onChange: (key: AudioPropertyKey) => void;
  /** Keys of properties already animated on the active track (shown as disabled). */
  animatedKeys?: AudioPropertyKey[];
}

export function AudioPropertyPicker({
  value,
  onChange,
  animatedKeys = [],
}: AudioPropertyPickerProps) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => onChange(v as AudioPropertyKey)}
    >
      <SelectTrigger className="flex-1">
        <SelectValue placeholder="Pick a property..." />
      </SelectTrigger>
      <SelectContent>
        {AUDIO_PROPERTIES.map((prop) => {
          const isAnimated = animatedKeys.includes(prop.key);
          return (
            <SelectItem
              key={prop.key}
              value={prop.key}
              disabled={isAnimated}
              className={isAnimated ? "opacity-40" : undefined}
            >
              {prop.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
