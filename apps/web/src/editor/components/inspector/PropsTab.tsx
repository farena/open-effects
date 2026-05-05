"use client";

import { useState } from "react";
import { useEditorStore } from "@/editor/store";
import { selectActiveLayer, selectActiveScene } from "@/editor/selectors";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SaveComponentDialog } from "@/editor/components/SaveComponentDialog";

export function PropsTab() {
  const layer = useEditorStore(selectActiveLayer);
  const scene = useEditorStore(selectActiveScene);
  const updateLayerName = useEditorStore((s) => s.updateLayerName);
  const updateLayerFrames = useEditorStore((s) => s.updateLayerFrames);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  if (!layer) return null;

  const maxFrame = scene?.durationFrames ?? Infinity;

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!layer) return;
    updateLayerName(layer.id, e.target.value);
  }

  function handleStartFrameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!layer) return;
    const raw = parseInt(e.target.value, 10);
    const value = isNaN(raw) ? 0 : Math.max(0, raw);
    updateLayerFrames(layer.id, value, layer.endFrame);
  }

  function handleEndFrameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!layer) return;
    const raw = parseInt(e.target.value, 10);
    const value = isNaN(raw) ? 0 : Math.min(Math.max(0, raw), maxFrame);
    updateLayerFrames(layer.id, layer.startFrame, value);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Props
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="layer-name">Name</Label>
          <Input
            id="layer-name"
            value={layer.name}
            onChange={handleNameChange}
            placeholder="Layer name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="layer-start-frame">Start Frame</Label>
          <Input
            id="layer-start-frame"
            type="number"
            min={0}
            value={layer.startFrame}
            onChange={handleStartFrameChange}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="layer-end-frame">End Frame</Label>
          <Input
            id="layer-end-frame"
            type="number"
            min={0}
            max={maxFrame === Infinity ? undefined : maxFrame}
            value={layer.endFrame}
            onChange={handleEndFrameChange}
          />
        </div>

        <div className="text-sm text-muted-foreground">
          Order: {layer.order}
        </div>

        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setSaveDialogOpen(true)}
          >
            Save as component…
          </Button>
        </div>
      </div>

      <SaveComponentDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
      />
    </div>
  );
}
