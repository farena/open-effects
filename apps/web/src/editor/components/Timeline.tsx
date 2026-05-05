"use client";

import { useCallback, useRef, useState } from "react";
import { useEditorStore } from "@/editor/store";
import {
  selectTotalDuration,
  selectActiveLayer,
  selectAnimatedProperties,
  selectKeyframesForProperty,
} from "@/editor/selectors";
import { PROPERTIES } from "@open-effects/runtime";
import type { Layer, Scene } from "@open-effects/shared-types";

// ---------------------------------------------------------------------------
// Helper: compute the global start frame of scene at index `i` in a
// *sorted* scene array (sorted by `order` ascending).
// ---------------------------------------------------------------------------
function computeSceneStarts(sorted: Scene[]): number[] {
  return sorted.reduce<number[]>((acc, _sc, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + sorted[i - 1].durationFrames);
    return acc;
  }, []);
}

// ---------------------------------------------------------------------------
// PropertyLane – one horizontal lane per animated property.
// ---------------------------------------------------------------------------
interface PropertyLaneProps {
  property: string;
  layer: Layer;
  sceneOffset: number; // global frame at which the containing scene starts
  total: number; // total timeline frames
}

function PropertyLane({ property, layer, sceneOffset, total }: PropertyLaneProps) {
  const keyframes = useEditorStore(selectKeyframesForProperty(property));
  const moveKeyframe = useEditorStore((s) => s.moveKeyframe);

  // Per-dot drag state: maps kf.frame (local) → current dragged globalFrame
  const [dragFrames, setDragFrames] = useState<Record<number, number>>({});
  const dragState = useRef<{
    kfFrame: number; // original local frame of the keyframe being dragged
    laneRect: DOMRect;
  } | null>(null);

  const label = PROPERTIES[property]?.label ?? property;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, kfFrame: number) => {
      e.preventDefault();
      const lane = (e.currentTarget.parentElement as HTMLElement);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = {
        kfFrame,
        laneRect: lane.getBoundingClientRect(),
      };
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, kfFrame: number) => {
      if (!dragState.current || dragState.current.kfFrame !== kfFrame) return;
      const { laneRect } = dragState.current;
      const raw = ((e.clientX - laneRect.left) / laneRect.width) * total;
      const next = Math.round(Math.max(0, Math.min(total, raw)));
      setDragFrames((prev) => ({ ...prev, [kfFrame]: next }));
    },
    [total],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, kfFrame: number) => {
      if (!dragState.current || dragState.current.kfFrame !== kfFrame) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      const draggedGlobal = dragFrames[kfFrame];
      dragState.current = null;
      // Clear dragged state regardless of outcome
      setDragFrames((prev) => {
        const next = { ...prev };
        delete next[kfFrame];
        return next;
      });
      if (draggedGlobal === undefined) return;
      const globalOriginal = sceneOffset + layer.startFrame + kfFrame;
      if (draggedGlobal === globalOriginal) return;
      // Convert global back to local keyframe frame
      const targetLocal = draggedGlobal - sceneOffset - layer.startFrame;
      if (targetLocal < 0 || targetLocal > total) return; // out-of-range: snap back
      moveKeyframe(layer.id, property, kfFrame, targetLocal);
    },
    [dragFrames, sceneOffset, layer, property, total, moveKeyframe],
  );

  return (
    <div className="relative flex items-center h-5">
      {/* Lane label */}
      <span
        className="absolute -left-20 top-0.5 w-20 truncate text-right text-[10px] text-muted-foreground"
        title={label}
      >
        {label}
      </span>

      {/* Lane track */}
      <div className="relative w-full h-full rounded bg-muted/30">
        {keyframes.map((kf) => {
          const globalFrame =
            dragFrames[kf.frame] !== undefined
              ? dragFrames[kf.frame]
              : sceneOffset + layer.startFrame + kf.frame;
          const leftPct = total > 0 ? (globalFrame / total) * 100 : 0;

          return (
            <div
              key={kf.frame}
              data-testid="keyframe-dot"
              className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-primary cursor-grab active:cursor-grabbing"
              style={{
                left: `${leftPct}%`,
                transform: "translate(-50%, -50%)",
              }}
              onPointerDown={(e) => handlePointerDown(e, kf.frame)}
              onPointerMove={(e) => handlePointerMove(e, kf.frame)}
              onPointerUp={(e) => handlePointerUp(e, kf.frame)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
export function Timeline() {
  const scenes = useEditorStore((s) => s.project.scenes);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const total = useEditorStore(selectTotalDuration);
  const activeLayer = useEditorStore(selectActiveLayer);
  const animatedProps = useEditorStore(selectAnimatedProperties);

  const sorted = [...scenes].sort((a, b) => a.order - b.order);

  // Compute the global start frame of the scene containing the active layer.
  const sceneOffset = (() => {
    if (!activeLayer) return 0;
    const sceneStarts = computeSceneStarts(sorted);
    const idx = sorted.findIndex((sc) =>
      sc.layers.some((l) => l.id === activeLayer.id),
    );
    return idx >= 0 ? sceneStarts[idx] : 0;
  })();

  const showLanes =
    activeLayer !== null && animatedProps.length > 0 && total > 0;

  return (
    <div className="flex h-full flex-col bg-muted/20 p-2">
      <div className="text-xs text-muted-foreground mb-1">
        Timeline · {total} frames
      </div>

      {/* Scene strip */}
      <div className="relative flex h-12 w-full overflow-hidden rounded border bg-background">
        {sorted.map((scene, index) => {
          const widthPct =
            total > 0 ? (scene.durationFrames / total) * 100 : 0;
          const isSelected = selectedSceneId === scene.id;

          return (
            <button
              key={scene.id}
              onClick={() => selectScene(scene.id)}
              className={[
                "flex flex-col items-start justify-center px-2 h-full border-r last:border-r-0 overflow-hidden text-left transition-colors",
                isSelected
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted text-foreground",
              ].join(" ")}
              style={{ width: `${widthPct}%` }}
              aria-label={`Select Scene ${index + 1}`}
            >
              <span className="text-xs font-medium truncate leading-none">
                Scene {index + 1}
              </span>
              <span className="text-xs text-muted-foreground leading-none mt-0.5">
                {scene.durationFrames}f
              </span>
            </button>
          );
        })}

        {/* Playhead cursor */}
        {total > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none"
            style={{ left: `${(currentFrame / total) * 100}%` }}
            aria-hidden
          />
        )}
      </div>

      {/* Keyframe lanes (one per animated property on the active layer) */}
      {showLanes && (
        <div className="mt-1 ml-20 flex flex-col gap-1">
          {animatedProps.map((prop) => (
            <PropertyLane
              key={prop}
              property={prop}
              layer={activeLayer}
              sceneOffset={sceneOffset}
              total={total}
            />
          ))}
        </div>
      )}
    </div>
  );
}
