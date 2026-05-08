"use client";

import { useState } from "react";
import { useEditorStore } from "@/editor/store";
import { selectActiveScene } from "@/editor/selectors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Transition } from "@open-effects/shared-types";

const TRANSITION_TYPES = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "slide-left", label: "Slide left" },
  { value: "slide-right", label: "Slide right" },
  { value: "slide-up", label: "Slide up" },
  { value: "slide-down", label: "Slide down" },
] as const;

const DEFAULT_DURATION = 15;

export function TransitionTab() {
  const scene = useEditorStore(selectActiveScene);
  const scenes = useEditorStore((s) => s.project.scenes);
  const setSceneTransition = useEditorStore((s) => s.setSceneTransition);
  const [durationError, setDurationError] = useState<string | null>(null);

  if (!scene) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No scene selected.
      </div>
    );
  }

  const sceneIndex = scenes.findIndex((s) => s.id === scene.id);
  const isFirstScene = sceneIndex === 0;
  const prevScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
  const transition: Transition = scene.transitionIn ?? {
    type: "none",
    durationFrames: DEFAULT_DURATION,
  };
  const maxDuration = prevScene
    ? Math.min(scene.durationFrames, prevScene.durationFrames)
    : scene.durationFrames;

  const onTypeChange = (value: string) => {
    setDurationError(null);
    if (value === "none") {
      setSceneTransition(scene.id, null);
      return;
    }
    setSceneTransition(scene.id, {
      type: value as Transition["type"],
      durationFrames: Math.min(transition.durationFrames, maxDuration),
    });
  };

  const onDurationChange = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      setDurationError("Must be a number.");
      return;
    }
    if (n < 1) {
      setDurationError("Must be at least 1 frame.");
      return;
    }
    if (n > maxDuration) {
      setDurationError(
        `Must be ≤ ${maxDuration} (min of this scene and previous scene).`,
      );
    } else {
      setDurationError(null);
    }
    if (transition.type === "none") return;
    setSceneTransition(scene.id, {
      type: transition.type,
      durationFrames: n,
    });
  };

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      {isFirstScene ? (
        <p className="text-xs text-muted-foreground">
          The first scene cannot have a transition.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Applies when this scene starts.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transition-type">Type</Label>
        <Select
          value={transition.type}
          onValueChange={onTypeChange}
          disabled={isFirstScene}
        >
          <SelectTrigger id="transition-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRANSITION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transition-duration">Duration (frames)</Label>
        <Input
          id="transition-duration"
          type="number"
          min={1}
          max={maxDuration}
          step={1}
          value={transition.durationFrames}
          onChange={(e) => onDurationChange(e.target.value)}
          disabled={isFirstScene || transition.type === "none"}
          aria-invalid={durationError !== null}
        />
        {durationError && (
          <p className="text-xs text-destructive">{durationError}</p>
        )}
      </div>
    </div>
  );
}
