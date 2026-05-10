"use client";

import dynamic from "next/dynamic";
import { useMemo, type ComponentType } from "react";
import type {
  Easing,
  Keyframe,
  Layer,
  Project,
} from "@open-effects/shared-types";
import { OpenEffectsComposition } from "@open-effects/runtime";
import { useEditorStore } from "@/editor/store";
import type { AnimationPreset } from "@/editor/presets/types";
import { buildPresetKeyframes } from "@/editor/presets/build-keyframes";
import { detectPresetConflicts } from "@/editor/presets/detect-conflicts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Player = dynamic(() => import("@remotion/player").then((m) => m.Player), {
  ssr: false,
});

const RemotionComp = OpenEffectsComposition as ComponentType<
  Record<string, unknown>
>;

interface PresetPreviewModalProps {
  open: boolean;
  onClose: () => void;
  layer: Layer;
  preset: AnimationPreset;
  duration: number;
  easing: Easing;
  values: Record<string, number | string>;
  anchorFrame: number;
}

export function PresetPreviewModal({
  open,
  onClose,
  layer,
  preset,
  duration,
  easing,
  values,
  anchorFrame,
}: PresetPreviewModalProps) {
  const project = useEditorStore((s) => s.project);

  const preview = useMemo(() => {
    if (!open) return null;

    const sceneIndex = project.scenes.findIndex((s) =>
      s.layers.some((l) => l.id === layer.id),
    );
    if (sceneIndex < 0) return null;

    const clone = structuredClone(project) as Project;
    const scene = clone.scenes[sceneIndex];
    if (!scene) return null;
    const clonedLayer = scene.layers.find((l) => l.id === layer.id);
    if (!clonedLayer) return null;

    const ctxAnchor = preset.category === "effect" ? anchorFrame : -1;
    const ctx = {
      layer: clonedLayer,
      duration,
      easing,
      anchorFrame: ctxAnchor,
      values,
    };

    const newKfs: Keyframe[] = buildPresetKeyframes(preset, ctx);
    clonedLayer.keyframes = [...clonedLayer.keyframes, ...newKfs];

    const conflicts = detectPresetConflicts(layer, preset, ctx);

    clone.scenes = [scene];

    return {
      project: clone,
      durationInFrames: Math.max(1, scene.durationFrames),
      conflictProperties: conflicts.map((c) => c.property),
    };
  }, [open, project, layer, preset, duration, easing, values, anchorFrame]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preview: {preset.name}</DialogTitle>
          <DialogDescription>
            Looping the scene with the preset applied to &quot;{layer.name}
            &quot;. The actual layer is not modified — close to keep editing.
          </DialogDescription>
        </DialogHeader>

        {preview && preview.conflictProperties.length > 0 && (
          <p className="text-xs text-amber-500">
            This layer already has keyframes on{" "}
            {preview.conflictProperties.join(", ")}; the preview merges them
            with the preset (the same as choosing &quot;Keep both&quot; on
            apply).
          </p>
        )}

        <div className="aspect-video w-full overflow-hidden rounded bg-black/90">
          {preview ? (
            <Player
              component={RemotionComp}
              inputProps={{ project: preview.project }}
              durationInFrames={preview.durationInFrames}
              compositionWidth={preview.project.width}
              compositionHeight={preview.project.height}
              fps={preview.project.fps}
              loop
              autoPlay
              controls
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              Could not build preview.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
