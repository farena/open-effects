"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/editor/store";
import {
  selectActiveLayer,
  selectActiveScene,
  selectAnimatedProperties,
  selectAnimatedSceneProperties,
  selectLocalFrameInActiveLayer,
  selectLocalFrameInActiveScene,
} from "@/editor/selectors";
import { PROPERTIES } from "@open-effects/runtime";
import type { Easing, Keyframe } from "@open-effects/shared-types";
import { PropertyPicker } from "./PropertyPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { EasingEditor } from "./EasingEditor";
import { colorToHex, hexToRgba } from "./colorCss";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type KeyframeTarget =
  | { kind: "layer"; id: string }
  | { kind: "scene"; id: string };

/** Pick a starting value for a new keyframe using the "closest prior keyframe" heuristic. */
function resolveInitialValue(
  keyframes: Keyframe[],
  property: string,
  currentFrame: number,
): string {
  if (keyframes.length === 0) {
    return PROPERTIES[property]?.defaultValue ?? "0";
  }

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

  const prior = [...sorted].reverse().find((k) => k.frame <= currentFrame);
  if (prior) return prior.value;

  const next = sorted.find((k) => k.frame > currentFrame);
  if (next) return next.value;

  return PROPERTIES[property]?.defaultValue ?? "0";
}

function easingLabel(kf: Keyframe): string {
  return kf.easingOut.type;
}

function maxKeyframeFrameForTarget(target: KeyframeTarget): number {
  const s = useEditorStore.getState();
  if (target.kind === "layer") {
    for (const sc of s.project.scenes) {
      const layer = sc.layers.find((l) => l.id === target.id);
      if (layer) {
        return Math.max(0, layer.endFrame - layer.startFrame - 1);
      }
    }
    return 0;
  }
  const sc = s.project.scenes.find((x) => x.id === target.id);
  return sc ? Math.max(0, sc.durationFrames - 1) : 0;
}

// ---------------------------------------------------------------------------
// Keyframe row
// ---------------------------------------------------------------------------

interface KeyframeRowProps {
  target: KeyframeTarget;
  property: string;
  keyframe: Keyframe;
}

function KeyframeRow({ target, property, keyframe }: KeyframeRowProps) {
  const moveKeyframe = useEditorStore((s) => s.moveKeyframe);
  const moveSceneKeyframe = useEditorStore((s) => s.moveSceneKeyframe);
  const updateKeyframeValue = useEditorStore((s) => s.updateKeyframeValue);
  const updateSceneKeyframeValue = useEditorStore(
    (s) => s.updateSceneKeyframeValue,
  );
  const updateKeyframeEasing = useEditorStore((s) => s.updateKeyframeEasing);
  const updateSceneKeyframeEasing = useEditorStore(
    (s) => s.updateSceneKeyframeEasing,
  );
  const deleteKeyframe = useEditorStore((s) => s.deleteKeyframe);
  const deleteSceneKeyframe = useEditorStore((s) => s.deleteSceneKeyframe);

  const [frameInput, setFrameInput] = useState(String(keyframe.frame));

  useEffect(() => {
    setFrameInput(String(keyframe.frame));
  }, [keyframe.frame]);

  const meta = PROPERTIES[property];
  const isColor = meta?.type === "color";
  const suffix =
    meta?.type === "length-px"
      ? "px"
      : meta?.type === "angle-deg"
        ? "deg"
        : null;

  const frameId = `frame-${target.kind}-${target.id}-${keyframe.id ?? keyframe.frame}-${property}`;

  function handleFrameBlur() {
    const parsed = parseInt(frameInput, 10);
    const maxF = maxKeyframeFrameForTarget(target);
    if (isNaN(parsed) || parsed < 0 || parsed > maxF) {
      setFrameInput(String(keyframe.frame));
      return;
    }
    if (parsed !== keyframe.frame) {
      if (target.kind === "layer") {
        moveKeyframe(target.id, property, keyframe.frame, parsed);
      } else {
        moveSceneKeyframe(target.id, property, keyframe.frame, parsed);
      }
    }
  }

  function handleValueBlur(newValue: string) {
    if (newValue === keyframe.value) return;
    if (target.kind === "layer") {
      updateKeyframeValue(target.id, property, keyframe.frame, newValue);
    } else {
      updateSceneKeyframeValue(target.id, property, keyframe.frame, newValue);
    }
  }

  function handleDelete() {
    if (target.kind === "layer") {
      deleteKeyframe(target.id, property, keyframe.frame);
    } else {
      deleteSceneKeyframe(target.id, property, keyframe.frame);
    }
  }

  function handleEasingSave(next: Easing) {
    if (target.kind === "layer") {
      updateKeyframeEasing(target.id, property, keyframe.frame, next);
    } else {
      updateSceneKeyframeEasing(target.id, property, keyframe.frame, next);
    }
  }

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex w-16 shrink-0 flex-col gap-0.5">
        <Label className="text-xs text-muted-foreground">Frame</Label>
        <Input
          id={frameId}
          type="number"
          min={0}
          max={maxKeyframeFrameForTarget(target)}
          className="h-7 px-1.5 text-xs"
          value={frameInput}
          onChange={(e) => setFrameInput(e.target.value)}
          onBlur={handleFrameBlur}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Label className="text-xs text-muted-foreground">Value</Label>
        {isColor ? (
          <input
            type="color"
            className="h-7 w-full cursor-pointer rounded-md border border-input bg-background"
            value={colorToHex(keyframe.value)}
            onChange={(e) => {
              handleValueBlur(hexToRgba(e.target.value));
            }}
          />
        ) : (
          <div className="flex items-center gap-1">
            <Input
              type="text"
              className="h-7 px-1.5 text-xs"
              defaultValue={keyframe.value}
              key={`${keyframe.frame}-${keyframe.value}`}
              onBlur={(e) => handleValueBlur(e.target.value)}
            />
            {suffix && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {suffix}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-0.5">
        <Label className="text-xs text-muted-foreground">Easing</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              data-testid="easing-button"
            >
              {easingLabel(keyframe)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <EasingEditor
              easing={keyframe.easingOut}
              onSave={handleEasingSave}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="mt-4 flex shrink-0 flex-col gap-0.5">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={handleDelete}
          aria-label="Delete keyframe"
        >
          <span className="text-sm leading-none">x</span>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated property block
// ---------------------------------------------------------------------------

interface AnimatedPropertyBlockProps {
  target: KeyframeTarget;
  property: string;
  currentFrameLocal: number;
  keyframes: Keyframe[];
}

function AnimatedPropertyBlock({
  target,
  property,
  currentFrameLocal,
  keyframes,
}: AnimatedPropertyBlockProps) {
  const addKeyframe = useEditorStore((s) => s.addKeyframe);
  const addSceneKeyframe = useEditorStore((s) => s.addSceneKeyframe);

  const meta = PROPERTIES[property];
  if (!meta) return null;

  function handleAddKeyframeHere() {
    const value = resolveInitialValue(keyframes, property, currentFrameLocal);
    if (target.kind === "layer") {
      addKeyframe(target.id, property, currentFrameLocal, value);
    } else {
      addSceneKeyframe(target.id, property, currentFrameLocal, value);
    }
  }

  return (
    <details
      open
      className="mb-3 overflow-hidden rounded-md border border-border"
    >
      <summary className="flex cursor-pointer select-none items-center justify-between bg-muted/40 px-3 py-2 text-sm font-medium hover:bg-muted/70">
        <span>{meta.label}</span>
        <span className="text-xs text-muted-foreground">
          {keyframes.length} kf
        </span>
      </summary>
      <div className="px-3 pb-2">
        {keyframes.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            No keyframes for this property — pick a frame below and add one.
          </p>
        ) : (
          keyframes.map((kf) => (
            <KeyframeRow
              key={`${kf.frame}-${kf.property}`}
              target={target}
              property={property}
              keyframe={kf}
            />
          ))
        )}
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 h-7 w-full justify-start text-xs"
          onClick={handleAddKeyframeHere}
        >
          + keyframe at frame {currentFrameLocal}
        </Button>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function KeyframesTab() {
  const layer = useEditorStore(selectActiveLayer);
  const scene = useEditorStore(selectActiveScene);
  const animatedLayer = useEditorStore(selectAnimatedProperties);
  const animatedScene = useEditorStore(selectAnimatedSceneProperties);
  const localLayerFrame = useEditorStore(selectLocalFrameInActiveLayer);
  const localSceneFrame = useEditorStore(selectLocalFrameInActiveScene);
  const globalFrame = useEditorStore((s) => s.currentFrame);
  const addKeyframe = useEditorStore((s) => s.addKeyframe);
  const addSceneKeyframe = useEditorStore((s) => s.addSceneKeyframe);

  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);

  if (layer) {
    const activeLayer = layer;
    const target: KeyframeTarget = { kind: "layer", id: activeLayer.id };
    const animatedProperties = animatedLayer;

    function handleAddKeyframe() {
      if (!selectedProperty) return;
      const kfs = activeLayer.keyframes.filter(
        (k) => k.property === selectedProperty,
      );
      const value = resolveInitialValue(kfs, selectedProperty, localLayerFrame);
      addKeyframe(activeLayer.id, selectedProperty, localLayerFrame, value);
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Keyframes · layer
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            Global {globalFrame} · local {localLayerFrame}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex items-center gap-2">
            <PropertyPicker
              value={selectedProperty}
              onChange={setSelectedProperty}
              excludedKeys={animatedProperties}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!selectedProperty}
              onClick={handleAddKeyframe}
              className="shrink-0"
            >
              + Add keyframe
            </Button>
          </div>

          {animatedProperties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No animated properties yet. Pick a property above and add a
              keyframe.
            </p>
          ) : (
            <div className="flex flex-col">
              {animatedProperties.map((prop) => (
                <AnimatedPropertyBlock
                  key={prop}
                  target={target}
                  property={prop}
                  currentFrameLocal={localLayerFrame}
                  keyframes={activeLayer.keyframes.filter(
                    (k) => k.property === prop,
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (scene) {
    const activeScene = scene;
    const target: KeyframeTarget = { kind: "scene", id: activeScene.id };
    const animatedProperties = animatedScene;

    function handleAddKeyframe() {
      if (!selectedProperty) return;
      const kfs = activeScene.keyframes.filter(
        (k) => k.property === selectedProperty,
      );
      const value = resolveInitialValue(kfs, selectedProperty, localSceneFrame);
      addSceneKeyframe(
        activeScene.id,
        selectedProperty,
        localSceneFrame,
        value,
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Keyframes · scene
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            Global {globalFrame} · local {localSceneFrame}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex items-center gap-2">
            <PropertyPicker
              value={selectedProperty}
              onChange={setSelectedProperty}
              excludedKeys={animatedProperties}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!selectedProperty}
              onClick={handleAddKeyframe}
              className="shrink-0"
            >
              + Add keyframe
            </Button>
          </div>

          {animatedProperties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scene keyframes yet. Use opacity or transform to transition
              between scenes.
            </p>
          ) : (
            <div className="flex flex-col">
              {animatedProperties.map((prop) => (
                <AnimatedPropertyBlock
                  key={prop}
                  target={target}
                  property={prop}
                  currentFrameLocal={localSceneFrame}
                  keyframes={activeScene.keyframes.filter(
                    (k) => k.property === prop,
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 text-sm text-muted-foreground">
      Select a scene or layer to manage keyframes.
    </div>
  );
}
