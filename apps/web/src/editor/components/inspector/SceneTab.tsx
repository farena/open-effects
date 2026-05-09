"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/editor/store";
import { selectActiveScene } from "@/editor/selectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "./ColorPicker";

type DurationUnit = "frames" | "seconds";

export function SceneTab() {
  const scene = useEditorStore(selectActiveScene);
  const fps = useEditorStore((s) => s.project.fps);
  const updateSceneName = useEditorStore((s) => s.updateSceneName);
  const updateSceneBackground = useEditorStore((s) => s.updateSceneBackground);
  const setSceneDuration = useEditorStore((s) => s.setSceneDuration);

  const [unit, setUnit] = useState<DurationUnit>("frames");
  const [durationError, setDurationError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");

  // Re-sync the input each time the underlying frames change or the user
  // toggles the unit. Frames are always the source of truth.
  useEffect(() => {
    if (!scene) return;
    if (unit === "frames") {
      setDraft(String(scene.durationFrames));
    } else {
      setDraft((scene.durationFrames / fps).toFixed(3).replace(/\.?0+$/, ""));
    }
    setDurationError(null);
  }, [unit, scene, fps]);

  if (!scene) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No scene selected.
      </div>
    );
  }

  function commitDuration(raw: string) {
    if (!scene) return;
    const parsed = unit === "frames" ? parseInt(raw, 10) : parseFloat(raw);
    if (!Number.isFinite(parsed)) {
      setDurationError("Must be a number.");
      return;
    }
    const frames =
      unit === "frames" ? parsed : Math.max(1, Math.round(parsed * fps));
    if (frames < 1) {
      setDurationError(
        unit === "frames"
          ? "Must be at least 1 frame."
          : `Must be at least ${(1 / fps).toFixed(3)} s.`,
      );
      return;
    }
    setDurationError(null);
    setSceneDuration(scene.id, frames);
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scene-name">Name</Label>
        <Input
          id="scene-name"
          value={scene.name}
          onChange={(e) => updateSceneName(scene.id, e.target.value)}
          className="font-medium"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scene-duration">
          Duration ({unit === "frames" ? "frames" : "seconds"})
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="scene-duration"
            type="number"
            min={unit === "frames" ? 1 : 1 / fps}
            step={unit === "frames" ? 1 : 0.001}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commitDuration(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDuration(draft);
            }}
            aria-invalid={durationError !== null}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            aria-label={`Switch duration unit (currently ${unit})`}
            title={`Showing ${unit}. Click to switch — value is always stored in frames.`}
            onClick={() =>
              setUnit((u) => (u === "frames" ? "seconds" : "frames"))
            }
          >
            {unit === "frames" ? "f" : "s"}
          </Button>
        </div>
        {durationError && (
          <p className="text-xs text-destructive">{durationError}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {scene.durationFrames} frames · {(scene.durationFrames / fps).toFixed(
            3,
          )}{" "}
          s @ {fps} fps
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Background</Label>
        <ColorPicker
          key={scene.id}
          id="scene-background"
          value={scene.background}
          onChange={(v) => updateSceneBackground(scene.id, v)}
        />
      </div>
    </div>
  );
}
