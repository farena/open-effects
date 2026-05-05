"use client";

import { useEditorStore } from "@/editor/store";
import { selectActiveScene } from "@/editor/selectors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "./ColorPicker";

export function SceneTab() {
  const scene = useEditorStore(selectActiveScene);
  const updateSceneName = useEditorStore((s) => s.updateSceneName);
  const updateSceneBackground = useEditorStore((s) => s.updateSceneBackground);
  const setSceneDuration = useEditorStore((s) => s.setSceneDuration);

  if (!scene) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No scene selected.
      </div>
    );
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
        <Label htmlFor="scene-frames">Duration (frames)</Label>
        <Input
          id="scene-frames"
          type="number"
          min={1}
          step={1}
          value={scene.durationFrames}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 1) {
              setSceneDuration(scene.id, n);
            }
          }}
        />
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
