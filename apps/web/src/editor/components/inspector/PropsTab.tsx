"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
import { useEditorStore } from "@/editor/store";
import { selectActiveLayer, selectActiveScene } from "@/editor/selectors";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SaveComponentDialog } from "@/editor/components/SaveComponentDialog";
// Inline form schema for the props fields we expose in this tab.
// Constraints mirror LayerSchema in shared-types and add the
// cross-entity endFrame ≤ scene.durationFrames rule.
function makeLayerPropsSchema(durationFrames: number) {
  return z
    .object({
      name: z
        .string()
        .min(1, "Name is required")
        .max(100, "Name must be 100 characters or less"),
      startFrame: z
        .number()
        .int("Must be a whole number")
        .min(0, "Start frame must be ≥ 0"),
      endFrame: z
        .number()
        .int("Must be a whole number")
        .min(0, "End frame must be ≥ 0"),
    })
    .refine((l) => l.endFrame >= l.startFrame, {
      message: "End frame must be ≥ start frame",
      path: ["endFrame"],
    })
    .refine((l) => l.endFrame <= durationFrames, {
      message: `End frame must be ≤ scene duration (${durationFrames})`,
      path: ["endFrame"],
    });
}

type PropsErrors = Partial<Record<"name" | "startFrame" | "endFrame", string>>;

function collectErrors(issues: z.ZodIssue[]): PropsErrors {
  const errors: PropsErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof PropsErrors;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

export function PropsTab() {
  const layer = useEditorStore(selectActiveLayer);
  const scene = useEditorStore(selectActiveScene);
  const updateLayerName = useEditorStore((s) => s.updateLayerName);
  const updateLayerFrames = useEditorStore((s) => s.updateLayerFrames);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<PropsErrors>({});

  const durationFrames = scene?.durationFrames ?? Infinity;

  // Re-validate whenever the layer or scene changes so errors stay in sync.
  useEffect(() => {
    if (!layer) {
      setFieldErrors({});
      return;
    }
    const schema = makeLayerPropsSchema(
      scene?.durationFrames ?? Number.MAX_SAFE_INTEGER,
    );
    const result = schema.safeParse({
      name: layer.name,
      startFrame: layer.startFrame,
      endFrame: layer.endFrame,
    });
    setFieldErrors(result.success ? {} : collectErrors(result.error.issues));
  }, [layer, scene]);

  if (!layer) return null;

  const maxFrame = durationFrames === Infinity ? undefined : durationFrames;

  function validateAndSetErrors(
    name: string,
    startFrame: number,
    endFrame: number,
  ) {
    const schema = makeLayerPropsSchema(
      scene?.durationFrames ?? Number.MAX_SAFE_INTEGER,
    );
    const result = schema.safeParse({ name, startFrame, endFrame });
    setFieldErrors(result.success ? {} : collectErrors(result.error.issues));
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!layer) return;
    updateLayerName(layer.id, e.target.value);
    validateAndSetErrors(e.target.value, layer.startFrame, layer.endFrame);
  }

  function handleStartFrameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!layer) return;
    const raw = parseInt(e.target.value, 10);
    const value = isNaN(raw) ? 0 : Math.max(0, raw);
    updateLayerFrames(layer.id, value, layer.endFrame);
    validateAndSetErrors(layer.name, value, layer.endFrame);
  }

  function handleEndFrameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!layer) return;
    const raw = parseInt(e.target.value, 10);
    const value = isNaN(raw) ? 0 : Math.max(0, raw);
    updateLayerFrames(layer.id, layer.startFrame, value);
    validateAndSetErrors(layer.name, layer.startFrame, value);
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
          {fieldErrors.name && (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.name}
            </p>
          )}
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
          {fieldErrors.startFrame && (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.startFrame}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="layer-end-frame">End Frame</Label>
          <Input
            id="layer-end-frame"
            type="number"
            min={0}
            max={maxFrame}
            value={layer.endFrame}
            onChange={handleEndFrameChange}
          />
          {fieldErrors.endFrame && (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.endFrame}
            </p>
          )}
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
