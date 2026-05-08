"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import {
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronRight,
  Trash2,
  Music,
} from "lucide-react";
import { useEditorStore } from "@/editor/store";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  selectTotalDuration,
  selectActiveLayer,
  selectActiveScene,
  selectAnimatedProperties,
  selectAnimatedSceneProperties,
  selectKeyframesForProperty,
  selectKeyframesForPropertyOnScene,
} from "@/editor/selectors";
import { PROPERTIES } from "@open-effects/runtime";
import type { Layer, Scene } from "@open-effects/shared-types";
import { AudioStrip } from "./AudioStrip";
import {
  probeAudioDuration,
  secondsToFrames,
} from "@/editor/lib/probeAudioDuration";

const DEFAULT_PX_PER_FRAME = 4;
const MIN_PX_PER_FRAME = 0.35;
const MAX_PX_PER_FRAME = 48;
const STORAGE_PX_PER_FRAME = "oe-timeline-px-per-frame";
const STORAGE_LAYER_PANEL_W = "oe-timeline-layer-panel-w";
const MIN_LAYER_PANEL_W = 140;
const MAX_LAYER_PANEL_W = 520;
const DEFAULT_LAYER_PANEL_W = 220;
const ROW_H = 28;
const RULER_H = 28;
/** Must match keyframe rows on the right (header + lane stack with gap/py). */
const KEYFRAME_SIDEBAR_HEADER_H = 28;
const KEYFRAME_LANE_ROW_H = 24;
const KEYFRAME_LANE_GAP = 4;
const KEYFRAME_LANE_STACK_PY = 8;

function keyframeSectionHeight(propCount: number): number {
  if (propCount <= 0) return 0;
  return (
    KEYFRAME_SIDEBAR_HEADER_H +
    KEYFRAME_LANE_STACK_PY +
    propCount * KEYFRAME_LANE_ROW_H +
    (propCount - 1) * KEYFRAME_LANE_GAP
  );
}

function propertyDisplayLabel(property: string): string {
  return PROPERTIES[property]?.label ?? property;
}
/** Scene span bar color (distinct from per-layer label colors). */
const SCENE_TRACK_BG = "#5b21b6";
const LABEL_COLORS = [
  "#c94c4c",
  "#d9933b",
  "#c9b038",
  "#5fb57a",
  "#3aa89b",
  "#4f8fd7",
  "#9b6fd6",
  "#c76ba8",
];

function labelColorForLayerId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h + id.charCodeAt(i) * (i + 1)) % LABEL_COLORS.length;
  }
  return LABEL_COLORS[h]!;
}

function computeSceneStarts(sorted: Scene[]): number[] {
  return sorted.reduce<number[]>((acc, _sc, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1]! + sorted[i - 1]!.durationFrames);
    return acc;
  }, []);
}

function formatTimecode(frame: number, fps: number): string {
  const fi = Math.max(0, frame);
  const f = fi % fps;
  const totalSecs = Math.floor(fi / fps);
  const s = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const m = totalMins % 60;
  const h = Math.floor(totalMins / 60);
  const ff = String(f).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  if (h > 0) {
    return `${h}:${mm}:${ss}:${ff}`;
  }
  return `${m}:${ss}:${ff}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function useSyncedVerticalScroll() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const onLeftScroll = useCallback(() => {
    if (syncing.current) return;
    const l = leftRef.current;
    const r = rightRef.current;
    if (!l || !r) return;
    syncing.current = true;
    r.scrollTop = l.scrollTop;
    syncing.current = false;
  }, []);

  const onRightScroll = useCallback(() => {
    if (syncing.current) return;
    const l = leftRef.current;
    const r = rightRef.current;
    if (!l || !r) return;
    syncing.current = true;
    l.scrollTop = r.scrollTop;
    syncing.current = false;
  }, []);

  return { leftRef, rightRef, onLeftScroll, onRightScroll };
}

// ---------------------------------------------------------------------------
// PropertyLane — keyframe dots for one animated property (active layer)
// ---------------------------------------------------------------------------

interface PropertyLaneProps {
  property: string;
  layer: Layer;
  sceneOffset: number;
  total: number;
  timelineWidthPx: number;
}

function PropertyLane({
  property,
  layer,
  sceneOffset,
  total,
  timelineWidthPx,
}: PropertyLaneProps) {
  const keyframes = useEditorStore(selectKeyframesForProperty(property));
  const moveKeyframe = useEditorStore((s) => s.moveKeyframe);

  const [dragFrames, setDragFrames] = useState<Record<number, number>>({});
  const dragState = useRef<{
    kfFrame: number;
    laneRect: DOMRect;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, kfFrame: number) => {
      e.preventDefault();
      e.stopPropagation();
      const lane = e.currentTarget.parentElement as HTMLElement;
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
      setDragFrames((prev) => {
        const next = { ...prev };
        delete next[kfFrame];
        return next;
      });
      if (draggedGlobal === undefined) return;
      const globalOriginal = sceneOffset + layer.startFrame + kfFrame;
      if (draggedGlobal === globalOriginal) return;
      const targetLocal = draggedGlobal - sceneOffset - layer.startFrame;
      if (targetLocal < 0 || targetLocal > total) return;
      moveKeyframe(layer.id, property, kfFrame, targetLocal);
    },
    [dragFrames, sceneOffset, layer, property, total, moveKeyframe],
  );

  return (
    <div
      className="relative shrink-0 rounded bg-muted/25"
      style={{ width: timelineWidthPx, height: KEYFRAME_LANE_ROW_H }}
    >
      {keyframes.map((kf) => {
        const globalFrame =
          dragFrames[kf.frame] !== undefined
            ? dragFrames[kf.frame]!
            : sceneOffset + layer.startFrame + kf.frame;
        const leftPx = total > 0 ? (globalFrame / total) * timelineWidthPx : 0;

        return (
          <div
            key={kf.frame}
            data-testid="keyframe-dot"
            className="absolute top-1/2 z-[1] size-2.5 cursor-grab rounded-full bg-primary active:cursor-grabbing"
            style={{
              left: `${leftPx}px`,
              transform: "translate(-50%, -50%)",
            }}
            onPointerDown={(e) => handlePointerDown(e, kf.frame)}
            onPointerMove={(e) => handlePointerMove(e, kf.frame)}
            onPointerUp={(e) => handlePointerUp(e, kf.frame)}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScenePropertyLane — keyframe dots for one animated property (active scene)
// ---------------------------------------------------------------------------

interface ScenePropertyLaneProps {
  property: string;
  sceneId: string;
  sceneOffset: number;
  sceneDuration: number;
  total: number;
  timelineWidthPx: number;
}

function ScenePropertyLane({
  property,
  sceneId,
  sceneOffset,
  sceneDuration,
  total,
  timelineWidthPx,
}: ScenePropertyLaneProps) {
  const keyframes = useEditorStore((s) =>
    selectKeyframesForPropertyOnScene(sceneId, property)(s),
  );
  const moveSceneKeyframe = useEditorStore((s) => s.moveSceneKeyframe);

  const [dragFrames, setDragFrames] = useState<Record<number, number>>({});
  const dragState = useRef<{
    kfFrame: number;
    laneRect: DOMRect;
  } | null>(null);

  const maxLocal = Math.max(0, sceneDuration - 1);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, kfFrame: number) => {
      e.preventDefault();
      e.stopPropagation();
      const lane = e.currentTarget.parentElement as HTMLElement;
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
      setDragFrames((prev) => {
        const next = { ...prev };
        delete next[kfFrame];
        return next;
      });
      if (draggedGlobal === undefined) return;
      const globalOriginal = sceneOffset + kfFrame;
      if (draggedGlobal === globalOriginal) return;
      const targetLocal = Math.round(
        clamp(draggedGlobal - sceneOffset, 0, maxLocal),
      );
      if (targetLocal < 0 || targetLocal > maxLocal) return;
      moveSceneKeyframe(sceneId, property, kfFrame, targetLocal);
    },
    [dragFrames, sceneOffset, sceneId, property, maxLocal, moveSceneKeyframe],
  );

  return (
    <div
      className="relative shrink-0 rounded bg-muted/25"
      style={{ width: timelineWidthPx, height: KEYFRAME_LANE_ROW_H }}
    >
      {keyframes.map((kf) => {
        const globalFrame =
          dragFrames[kf.frame] !== undefined
            ? dragFrames[kf.frame]!
            : sceneOffset + kf.frame;
        const leftPx = total > 0 ? (globalFrame / total) * timelineWidthPx : 0;

        return (
          <div
            key={kf.frame}
            data-testid="scene-keyframe-dot"
            className="absolute top-1/2 z-[1] size-2.5 cursor-grab rounded-full bg-violet-400 active:cursor-grabbing"
            style={{
              left: `${leftPx}px`,
              transform: "translate(-50%, -50%)",
            }}
            onPointerDown={(e) => handlePointerDown(e, kf.frame)}
            onPointerMove={(e) => handlePointerMove(e, kf.frame)}
            onPointerUp={(e) => handlePointerUp(e, kf.frame)}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time ruler ticks
// ---------------------------------------------------------------------------

interface TimeRulerProps {
  total: number;
  fps: number;
  widthPx: number;
}

function TimeRuler({ total, fps, widthPx }: TimeRulerProps) {
  const ticks = useMemo(() => {
    if (total <= 0) return [];
    // Aim for ~6–12 labels across the width
    const rawStep = Math.max(1, Math.round(total / 10));
    const pow10 = 10 ** Math.floor(Math.log10(rawStep));
    const step = Math.max(1, Math.round(rawStep / pow10) * pow10);
    const out: number[] = [];
    for (let f = 0; f <= total; f += step) {
      out.push(f);
    }
    if (out[out.length - 1] !== total) {
      out.push(total);
    }
    return out;
  }, [total]);

  return (
    <div
      className="relative shrink-0 border-b border-[#3a3a3a] bg-[#1e1e1e]"
      style={{ height: RULER_H, width: widthPx, pointerEvents: "none" }}
    >
      {ticks.map((f) => (
        <div
          key={f}
          className="absolute top-0 flex flex-col items-center border-l border-[#4a4a4a]"
          style={{ left: (f / Math.max(total, 1)) * widthPx, height: "100%" }}
        >
          <span className="mt-0.5 pl-0.5 font-mono text-[10px] leading-none text-[#b8b8b8]">
            {formatTimecode(f, fps)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layer bar (in / out / move)
// ---------------------------------------------------------------------------

type BarDragMode = "move" | "in" | "out" | null;

interface LayerBarProps {
  layer: Layer;
  sceneOffset: number;
  sceneDuration: number;
  timelineWidthPx: number;
  total: number;
  isSelected: boolean;
  labelColor: string;
  pxPerFrame: number;
  onSelect: () => void;
}

function LayerBar({
  layer,
  sceneOffset,
  sceneDuration,
  timelineWidthPx,
  total,
  isSelected,
  labelColor,
  pxPerFrame,
  onSelect,
}: LayerBarProps) {
  const updateLayerFrames = useEditorStore((s) => s.updateLayerFrames);

  const globalStart = sceneOffset + layer.startFrame;
  const span = Math.max(1, layer.endFrame - layer.startFrame);
  const leftPx = total > 0 ? (globalStart / total) * timelineWidthPx : 0;
  const widthPx = total > 0 ? (span / total) * timelineWidthPx : 0;

  const dragRef = useRef<{
    mode: BarDragMode;
    startX: number;
    startFrame: number;
    endFrame: number;
  } | null>(null);

  const pxToFrameDelta = useCallback(
    (dxPx: number) => Math.round(dxPx / pxPerFrame),
    [pxPerFrame],
  );

  const applyFrames = useCallback(
    (start: number, end: number) => {
      const lo = 0;
      const hi = sceneDuration;
      const s = clamp(start, lo, hi);
      let e = clamp(end, lo, hi);
      if (e <= s) {
        e = Math.min(hi, s + 1);
      }
      updateLayerFrames(layer.id, s, e);
    },
    [layer.id, sceneDuration, updateLayerFrames],
  );

  const onPointerDownBar = useCallback(
    (e: React.PointerEvent, mode: BarDragMode) => {
      if (!mode) return;
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        startFrame: layer.startFrame,
        endFrame: layer.endFrame,
      };
    },
    [layer.startFrame, layer.endFrame],
  );

  const onPointerMoveBar = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dFrames = pxToFrameDelta(dx);
      const span0 = d.endFrame - d.startFrame;

      if (d.mode === "move") {
        const maxStart = Math.max(0, sceneDuration - span0);
        const nextStart = clamp(d.startFrame + dFrames, 0, maxStart);
        const nextEnd = nextStart + span0;
        applyFrames(nextStart, nextEnd);
      } else if (d.mode === "in") {
        const nextStart = clamp(d.startFrame + dFrames, 0, d.endFrame - 1);
        applyFrames(nextStart, d.endFrame);
      } else if (d.mode === "out") {
        const nextEnd = clamp(
          d.endFrame + dFrames,
          d.startFrame + 1,
          sceneDuration,
        );
        applyFrames(d.startFrame, nextEnd);
      }
    },
    [applyFrames, pxToFrameDelta, sceneDuration],
  );

  const onPointerUpBar = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  }, []);

  return (
    <div
      className="relative flex items-center border-b border-[#2d2d2d]"
      style={{ height: ROW_H, width: timelineWidthPx }}
    >
      <div
        className={[
          "absolute top-1.5 flex h-[calc(100%-12px)] min-w-[8px] cursor-grab items-stretch rounded-sm border border-black/40 shadow-sm",
          isSelected ? "ring-1 ring-white/50" : "",
        ].join(" ")}
        style={{
          left: leftPx,
          width: Math.max(widthPx, 6),
          backgroundColor: labelColor,
          opacity: layer.visible ? 0.92 : 0.28,
        }}
        onPointerDown={(e) => onPointerDownBar(e, "move")}
        onPointerMove={onPointerMoveBar}
        onPointerUp={onPointerUpBar}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        title={`${layer.name}: frames ${layer.startFrame}–${layer.endFrame}`}
      >
        <div
          className="w-2 shrink-0 cursor-ew-resize rounded-l-sm bg-black/25 hover:bg-black/40"
          onPointerDown={(e) => onPointerDownBar(e, "in")}
          onPointerMove={onPointerMoveBar}
          onPointerUp={onPointerUpBar}
          role="presentation"
        />
        <div className="min-w-0 flex-1" />
        <div
          className="w-2 shrink-0 cursor-ew-resize rounded-r-sm bg-black/25 hover:bg-black/40"
          onPointerDown={(e) => onPointerDownBar(e, "out")}
          onPointerMove={onPointerMoveBar}
          onPointerUp={onPointerUpBar}
          role="presentation"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene bar — global span + duration / boundary resize
// ---------------------------------------------------------------------------

interface SceneBarProps {
  scene: Scene;
  sceneIndex: number;
  sceneStarts: number[];
  timelineWidthPx: number;
  total: number;
  isSelected: boolean;
  pxPerFrame: number;
  onSelect: () => void;
}

function SceneBar({
  scene,
  sceneIndex,
  sceneStarts,
  timelineWidthPx,
  total,
  isSelected,
  pxPerFrame,
  onSelect,
}: SceneBarProps) {
  const setSceneDuration = useEditorStore((s) => s.setSceneDuration);
  const adjustSceneBoundaryAt = useEditorStore((s) => s.adjustSceneBoundaryAt);

  const globalStart = sceneStarts[sceneIndex]!;
  const span = Math.max(1, scene.durationFrames);
  const leftPx = total > 0 ? (globalStart / total) * timelineWidthPx : 0;
  const widthPx = total > 0 ? (span / total) * timelineWidthPx : 0;

  const dragRef = useRef<{
    mode: "in" | "out";
    startX: number;
    startDuration: number;
  } | null>(null);

  const pxToFrameDelta = useCallback(
    (dxPx: number) => Math.round(dxPx / pxPerFrame),
    [pxPerFrame],
  );

  const onPointerDownBar = useCallback(
    (e: React.PointerEvent, mode: "in" | "out") => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        startDuration: scene.durationFrames,
      };
    },
    [scene.durationFrames],
  );

  const onPointerMoveBar = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dFrames = pxToFrameDelta(dx);
      if (d.mode === "out") {
        const next = Math.max(1, d.startDuration + dFrames);
        setSceneDuration(scene.id, next);
      } else if (d.mode === "in" && sceneIndex > 0) {
        adjustSceneBoundaryAt(scene.id, dFrames);
      }
    },
    [
      scene.id,
      sceneIndex,
      pxToFrameDelta,
      setSceneDuration,
      adjustSceneBoundaryAt,
    ],
  );

  const onPointerUpBar = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  }, []);

  return (
    <div
      className="relative flex items-center border-b border-[#2d2d2d]"
      style={{ height: ROW_H, width: timelineWidthPx }}
    >
      <div
        className={[
          "absolute top-1.5 flex h-[calc(100%-12px)] min-w-[8px] cursor-default items-stretch rounded-sm border border-black/50 shadow-sm",
          isSelected ? "ring-1 ring-violet-300/60" : "",
        ].join(" ")}
        style={{
          left: leftPx,
          width: Math.max(widthPx, 6),
          backgroundColor: SCENE_TRACK_BG,
          opacity: 0.92,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        title={`${scene.name}: ${scene.durationFrames} frames`}
      >
        {sceneIndex > 0 ? (
          <div
            className="w-2 shrink-0 cursor-ew-resize rounded-l-sm bg-black/30 hover:bg-black/45"
            onPointerDown={(e) => onPointerDownBar(e, "in")}
            onPointerMove={onPointerMoveBar}
            onPointerUp={onPointerUpBar}
            role="presentation"
          />
        ) : (
          <div className="w-2 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1" />
        <div
          className="w-2 shrink-0 cursor-ew-resize rounded-r-sm bg-black/30 hover:bg-black/45"
          onPointerDown={(e) => onPointerDownBar(e, "out")}
          onPointerMove={onPointerMoveBar}
          onPointerUp={onPointerUpBar}
          role="presentation"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export function Timeline() {
  const scenes = useEditorStore((s) => s.project.scenes);
  const fps = useEditorStore((s) => s.project.fps);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const setCurrentFrame = useEditorStore((s) => s.setCurrentFrame);
  const total = useEditorStore(selectTotalDuration);
  const activeLayer = useEditorStore(selectActiveLayer);
  const activeScene = useEditorStore(selectActiveScene);
  const animatedProps = useEditorStore(selectAnimatedProperties);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const toggleLayerVisible = useEditorStore((s) => s.toggleLayerVisible);
  const animatedSceneProps = useEditorStore(selectAnimatedSceneProperties);
  const addLayer = useEditorStore((s) => s.addLayer);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);
  const addAudioTrack = useEditorStore((s) => s.addAudioTrack);

  const [expandedByScene, setExpandedByScene] = useState<
    Record<string, boolean>
  >({});

  const [pxPerFrame, setPxPerFrame] = useState(DEFAULT_PX_PER_FRAME);
  const [leftPanelW, setLeftPanelW] = useState(DEFAULT_LAYER_PANEL_W);
  const [layerPendingDelete, setLayerPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    try {
      const pxRaw = localStorage.getItem(STORAGE_PX_PER_FRAME);
      const wRaw = localStorage.getItem(STORAGE_LAYER_PANEL_W);
      if (pxRaw) {
        const n = parseFloat(pxRaw);
        if (Number.isFinite(n)) {
          setPxPerFrame(clamp(n, MIN_PX_PER_FRAME, MAX_PX_PER_FRAME));
        }
      }
      if (wRaw) {
        const n = parseInt(wRaw, 10);
        if (Number.isFinite(n)) {
          setLeftPanelW(clamp(n, MIN_LAYER_PANEL_W, MAX_LAYER_PANEL_W));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PX_PER_FRAME, String(pxPerFrame));
    } catch {
      /* ignore */
    }
  }, [pxPerFrame]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LAYER_PANEL_W, String(leftPanelW));
    } catch {
      /* ignore */
    }
  }, [leftPanelW]);

  const resizeDragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onDividerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      resizeDragRef.current = { startX: e.clientX, startW: leftPanelW };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [leftPanelW],
  );

  const onDividerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = resizeDragRef.current;
      if (!d) return;
      const next = clamp(
        d.startW + (e.clientX - d.startX),
        MIN_LAYER_PANEL_W,
        MAX_LAYER_PANEL_W,
      );
      setLeftPanelW(next);
    },
    [],
  );

  const onDividerPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      resizeDragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  const zoomOut = useCallback(() => {
    setPxPerFrame((p) => clamp(p / 1.2, MIN_PX_PER_FRAME, MAX_PX_PER_FRAME));
  }, []);

  const zoomIn = useCallback(() => {
    setPxPerFrame((p) => clamp(p * 1.2, MIN_PX_PER_FRAME, MAX_PX_PER_FRAME));
  }, []);

  const sorted = useMemo(
    () => [...scenes].sort((a, b) => a.order - b.order),
    [scenes],
  );
  const sceneStarts = useMemo(() => computeSceneStarts(sorted), [sorted]);

  useEffect(() => {
    setExpandedByScene((prev) => {
      const next = { ...prev };
      for (const sc of scenes) {
        if (next[sc.id] === undefined) next[sc.id] = true;
      }
      for (const id of Object.keys(next)) {
        if (!scenes.some((s) => s.id === id)) delete next[id];
      }
      return next;
    });
  }, [scenes]);

  const trackRowCount = useMemo(() => {
    let n = 0;
    for (const sc of sorted) {
      n += 1; // scene bar row
      if (expandedByScene[sc.id] !== false) n += sc.layers.length;
      n += 1; // audio lane row (always visible)
    }
    return n;
  }, [sorted, expandedByScene]);

  const sceneOffset = useMemo(() => {
    if (!activeScene) return 0;
    const idx = sorted.findIndex((sc) => sc.id === activeScene.id);
    return idx >= 0 ? sceneStarts[idx]! : 0;
  }, [activeScene, sorted, sceneStarts]);

  const timelineWidthPx = Math.max(total * pxPerFrame, 320);

  const { leftRef, rightRef, onLeftScroll, onRightScroll } =
    useSyncedVerticalScroll();

  const playheadDrag = useRef(false);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const scroller = rightRef.current;
      if (!scroller || total <= 0) return;
      const rect = scroller.getBoundingClientRect();
      const x = clientX - rect.left + scroller.scrollLeft;
      const f = Math.round((x / timelineWidthPx) * total);
      setCurrentFrame(clamp(f, 0, Math.max(0, total - 1)));
    },
    [rightRef, setCurrentFrame, timelineWidthPx, total],
  );

  const onTracksPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      seekFromClientX(e.clientX);
    },
    [seekFromClientX],
  );

  const onTracksPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      seekFromClientX(e.clientX);
    },
    [seekFromClientX],
  );

  const playheadLeftPx =
    total > 0 ? (currentFrame / total) * timelineWidthPx : 0;

  const showLayerKeyframeLanes =
    activeLayer !== null && animatedProps.length > 0 && total > 0;
  const showSceneKeyframeLanes =
    activeLayer === null &&
    activeScene !== null &&
    animatedSceneProps.length > 0 &&
    total > 0;

  const keyframeBlockHeight = showLayerKeyframeLanes
    ? keyframeSectionHeight(animatedProps.length)
    : showSceneKeyframeLanes
      ? keyframeSectionHeight(animatedSceneProps.length)
      : 0;

  const playheadTracksHeight =
    RULER_H + ROW_H * trackRowCount + keyframeBlockHeight;

  const toggleSceneExpanded = useCallback((id: string) => {
    setExpandedByScene((prev) => ({
      ...prev,
      [id]: !(prev[id] !== false),
    }));
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#232323] text-[#e8e8e8]">
      {/* Header: timecode + zoom */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#3a3a3a] bg-[#2a2a2a] px-2 py-1">
        <span className="font-mono text-xs tabular-nums text-[hsl(var(--timeline-hi))]">
          {formatTimecode(currentFrame, fps)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {currentFrame} / {Math.max(0, total - 1)} · {total}f
        </span>
        <div
          className="ml-auto flex shrink-0 items-center gap-1 rounded border border-[#444] bg-[#333] px-1 py-0.5"
          title="Horizontal zoom"
        >
          <button
            type="button"
            className="rounded p-0.5 text-[#ccc] hover:bg-[#444] hover:text-white"
            aria-label="Zoom timeline out"
            onClick={zoomOut}
          >
            <ZoomOut className="size-3.5" />
          </button>
          <input
            aria-label="Timeline zoom"
            className="h-1 w-16 cursor-pointer accent-[hsl(var(--primary))]"
            type="range"
            min={MIN_PX_PER_FRAME}
            max={MAX_PX_PER_FRAME}
            step={0.05}
            value={pxPerFrame}
            onChange={(e) =>
              setPxPerFrame(
                clamp(
                  parseFloat(e.target.value),
                  MIN_PX_PER_FRAME,
                  MAX_PX_PER_FRAME,
                ),
              )
            }
          />
          <button
            type="button"
            className="rounded p-0.5 text-[#ccc] hover:bg-[#444] hover:text-white"
            aria-label="Zoom timeline in"
            onClick={zoomIn}
          >
            <ZoomIn className="size-3.5" />
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-[#888]">
          Add a scene from the sidebar to start editing the timeline.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-row">
          {/* Layer list (left) */}
          <div
            className="flex shrink-0 flex-col border-r border-[#3a3a3a] bg-[#252525]"
            style={{ width: leftPanelW }}
          >
            <div
              className="flex shrink-0 items-center gap-1 border-b border-[#3a3a3a] px-1 text-[10px] font-semibold uppercase tracking-wide text-[#8a8a8a]"
              style={{ height: RULER_H }}
            >
              <span className="w-6 shrink-0 text-center" aria-hidden>
                ◦
              </span>
              <span className="w-5 shrink-0 text-center">#</span>
              <span className="w-3 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">Timeline</span>
            </div>
            <div
              ref={leftRef}
              onScroll={onLeftScroll}
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
            >
              {sorted.map((scene) => {
                const expanded = expandedByScene[scene.id] !== false;
                const layersInScene = [...scene.layers].sort(
                  (a, b) => a.order - b.order,
                );
                return (
                  <Fragment key={scene.id}>
                    <div
                      className={[
                        "flex cursor-pointer items-center gap-1 border-b border-[#2d2d2d] px-2 text-[11px]",
                        selectedSceneId === scene.id && selectedLayerId === null
                          ? "bg-[#3a2d58]"
                          : "hover:bg-[#2f2f2f]",
                      ].join(" ")}
                      style={{ height: ROW_H }}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectScene(scene.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectScene(scene.id);
                        }
                      }}
                    >
                      <button
                        type="button"
                        className="flex size-6 shrink-0 items-center justify-center rounded text-[#ccc] hover:bg-[#3a3a3a]"
                        aria-expanded={expanded}
                        aria-label={
                          expanded ? "Collapse scene" : "Expand scene"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSceneExpanded(scene.id);
                        }}
                      >
                        {expanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </button>
                      <span className="w-5 shrink-0" aria-hidden />
                      <span
                        className="size-2.5 shrink-0 rounded-sm border border-black/30"
                        style={{ backgroundColor: SCENE_TRACK_BG }}
                        title="Scene"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {scene.name}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded px-1 text-[10px] text-[#aaa] hover:bg-[#3a3a3a] hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          addLayer(scene.id);
                        }}
                        aria-label={`Add layer to ${scene.name}`}
                      >
                        +
                      </button>
                    </div>
                    {expanded &&
                      layersInScene.map((layer, i) => {
                        const revIndex = layersInScene.length - i;
                        const selected = selectedLayerId === layer.id;
                        const color = labelColorForLayerId(layer.id);
                        return (
                          <div
                            key={layer.id}
                            className={[
                              "flex items-center gap-1 border-b border-[#2d2d2d] px-2 text-[11px]",
                              selected ? "bg-[#3d4a5c]" : "hover:bg-[#2f2f2f]",
                            ].join(" ")}
                            style={{ height: ROW_H }}
                            onClick={() => selectLayer(layer.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                selectLayer(layer.id);
                              }
                            }}
                          >
                            <button
                              type="button"
                              className="flex size-6 shrink-0 items-center justify-center rounded text-[#aaa] hover:bg-[#3a3a3a] hover:text-white"
                              aria-label={
                                layer.visible ? "Hide layer" : "Show layer"
                              }
                              title={
                                layer.visible ? "Hide layer" : "Show layer"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLayerVisible(layer.id);
                              }}
                            >
                              {layer.visible ? (
                                <Eye className="size-3.5" />
                              ) : (
                                <EyeOff className="size-3.5 opacity-60" />
                              )}
                            </button>
                            <span className="w-5 shrink-0 text-center font-mono text-[10px] text-[#9a9a9a]">
                              {revIndex}
                            </span>
                            <span
                              className="size-2.5 shrink-0 rounded-sm border border-black/30"
                              style={{ backgroundColor: color }}
                              title="Label"
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {layer.name}
                            </span>
                            <button
                              type="button"
                              className="shrink-0 rounded p-0.5 text-[#aaa] hover:bg-[#5c2b2b] hover:text-white"
                              aria-label={`Remove layer ${layer.name}`}
                              title="Remove layer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLayerPendingDelete({
                                  id: layer.id,
                                  name: layer.name,
                                });
                              }}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        );
                      })}
                    {/* Audio lane label row — always shown per scene */}
                    <div
                      className="flex items-center gap-1 border-b border-[#2d2d2d] px-2 text-[11px] text-[#8a8a8a]"
                      style={{ height: ROW_H }}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center">
                        <Music className="size-3.5 opacity-60" />
                      </span>
                      <span className="w-5 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">Audio</span>
                    </div>
                  </Fragment>
                );
              })}
              {(showLayerKeyframeLanes || showSceneKeyframeLanes) && (
                <>
                  {showLayerKeyframeLanes && activeLayer && (
                    <>
                      <div
                        className="flex shrink-0 items-center gap-1 border-t border-[#3a3a3a] bg-[#252525] px-2 text-[10px] font-semibold uppercase tracking-wide text-[#8a8a8a]"
                        style={{ height: KEYFRAME_SIDEBAR_HEADER_H }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          Keyframes · {activeLayer.name}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1 py-1">
                        {animatedProps.map((prop) => (
                          <div
                            key={prop}
                            className="flex shrink-0 items-center border-b border-[#2d2d2d] px-2 text-[11px] text-[#c4c4c4]"
                            style={{ height: KEYFRAME_LANE_ROW_H }}
                            title={propertyDisplayLabel(prop)}
                          >
                            <span className="min-w-0 flex-1 truncate pl-5 font-medium">
                              {propertyDisplayLabel(prop)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {showSceneKeyframeLanes && activeScene && (
                    <>
                      <div
                        className="flex shrink-0 items-center gap-1 border-t border-[#3a3a3a] bg-[#252525] px-2 text-[10px] font-semibold uppercase tracking-wide text-[#8a8a8a]"
                        style={{ height: KEYFRAME_SIDEBAR_HEADER_H }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          Scene keyframes · {activeScene.name}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1 py-1">
                        {animatedSceneProps.map((prop) => (
                          <div
                            key={prop}
                            className="flex shrink-0 items-center border-b border-[#2d2d2d] px-2 text-[11px] text-[#c4c4c4]"
                            style={{ height: KEYFRAME_LANE_ROW_H }}
                            title={propertyDisplayLabel(prop)}
                          >
                            <span className="min-w-0 flex-1 truncate pl-5 font-medium">
                              {propertyDisplayLabel(prop)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize layer panel"
            className="w-1 shrink-0 cursor-col-resize border-x border-[#2a2a2a] bg-[#3a3a3a] hover:bg-[hsl(var(--primary))]"
            onPointerDown={onDividerPointerDown}
            onPointerMove={onDividerPointerMove}
            onPointerUp={onDividerPointerUp}
            onPointerCancel={onDividerPointerUp}
          />

          {/* Tracks + ruler (right) */}
          <div
            ref={rightRef}
            onScroll={onRightScroll}
            className="min-h-0 flex-1 overflow-auto bg-[#1b1b1b]"
          >
            <div className="relative" style={{ width: timelineWidthPx }}>
              <div
                className="relative"
                style={{ minHeight: RULER_H + ROW_H * trackRowCount }}
                onPointerDown={onTracksPointerDown}
                onPointerMove={onTracksPointerMove}
              >
                <TimeRuler total={total} fps={fps} widthPx={timelineWidthPx} />

                {sorted.map((scene, si) => {
                  const expanded = expandedByScene[scene.id] !== false;
                  const off = sceneStarts[si]!;
                  return (
                    <Fragment key={scene.id}>
                      <SceneBar
                        scene={scene}
                        sceneIndex={si}
                        sceneStarts={sceneStarts}
                        timelineWidthPx={timelineWidthPx}
                        total={total}
                        isSelected={
                          selectedSceneId === scene.id &&
                          selectedLayerId === null
                        }
                        pxPerFrame={pxPerFrame}
                        onSelect={() => selectScene(scene.id)}
                      />
                      {expanded &&
                        [...scene.layers]
                          .sort((a, b) => a.order - b.order)
                          .map((layer) => (
                            <LayerBar
                              key={layer.id}
                              layer={layer}
                              sceneOffset={off}
                              sceneDuration={scene.durationFrames}
                              timelineWidthPx={timelineWidthPx}
                              total={total}
                              isSelected={selectedLayerId === layer.id}
                              labelColor={labelColorForLayerId(layer.id)}
                              pxPerFrame={pxPerFrame}
                              onSelect={() => selectLayer(layer.id)}
                            />
                          ))}
                      {/* Audio lane drop zone */}
                      <div
                        className="relative border-b border-[#2d2d2d] bg-[#181c20]"
                        style={{ height: ROW_H, width: timelineWidthPx }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={async (e) => {
                          e.preventDefault();
                          const raw = e.dataTransfer.getData(
                            "application/x-asset",
                          );
                          if (!raw) return;
                          const { id, path } = JSON.parse(raw) as {
                            id: string;
                            path: string;
                          };
                          const seconds = await probeAudioDuration(path);
                          const fps = useEditorStore.getState().project.fps;
                          addAudioTrack(scene.id, {
                            id,
                            path,
                            durationFrames: secondsToFrames(seconds, fps),
                          });
                        }}
                      >
                        {(scene.audioTracks ?? []).map((t) => (
                          <AudioStrip
                            key={t.id}
                            track={t}
                            totalFrames={total}
                            timelineWidthPx={timelineWidthPx}
                            pxPerFrame={pxPerFrame}
                            probedDurationFrames={t.trimEnd}
                            sceneOffsetFrames={off}
                          />
                        ))}
                      </div>
                    </Fragment>
                  );
                })}
              </div>

              {showLayerKeyframeLanes && activeLayer && (
                <div className="border-t border-[#3a3a3a] bg-[#202020]">
                  <div
                    className="flex items-center border-b border-[#2d2d2d] px-2 text-[10px] font-semibold uppercase tracking-wide text-[#8a8a8a]"
                    style={{ height: KEYFRAME_SIDEBAR_HEADER_H }}
                  >
                    <span className="sr-only">
                      Keyframes timeline for layer {activeLayer.name}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 py-1">
                    {animatedProps.map((prop) => (
                      <PropertyLane
                        key={prop}
                        property={prop}
                        layer={activeLayer}
                        sceneOffset={sceneOffset}
                        total={total}
                        timelineWidthPx={timelineWidthPx}
                      />
                    ))}
                  </div>
                </div>
              )}

              {showSceneKeyframeLanes && activeScene && (
                <div className="border-t border-[#3a3a3a] bg-[#202020]">
                  <div
                    className="flex items-center border-b border-[#2d2d2d] px-2 text-[10px] font-semibold uppercase tracking-wide text-[#8a8a8a]"
                    style={{ height: KEYFRAME_SIDEBAR_HEADER_H }}
                  >
                    <span className="sr-only">
                      Scene keyframes timeline for {activeScene.name}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 py-1">
                    {animatedSceneProps.map((prop) => (
                      <ScenePropertyLane
                        key={prop}
                        property={prop}
                        sceneId={activeScene.id}
                        sceneOffset={sceneOffset}
                        sceneDuration={activeScene.durationFrames}
                        total={total}
                        timelineWidthPx={timelineWidthPx}
                      />
                    ))}
                  </div>
                </div>
              )}

              {total > 0 && (
                <>
                  <div
                    className="pointer-events-none absolute top-0 z-[2]"
                    style={{
                      left: playheadLeftPx,
                      height: playheadTracksHeight,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="h-full w-px bg-[#e63946]" />
                  </div>
                  <button
                    type="button"
                    aria-label="Playhead"
                    className="pointer-events-auto absolute top-0 z-[3] flex -translate-x-1/2 flex-col items-center bg-transparent p-0"
                    style={{ left: playheadLeftPx }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      playheadDrag.current = true;
                      (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      seekFromClientX(e.clientX);
                    }}
                    onPointerMove={(e) => {
                      if (!playheadDrag.current) return;
                      seekFromClientX(e.clientX);
                    }}
                    onPointerUp={(e) => {
                      playheadDrag.current = false;
                      (e.target as HTMLElement).releasePointerCapture(
                        e.pointerId,
                      );
                    }}
                  >
                    <span className="block h-0 w-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-[#f5d742]" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={layerPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setLayerPendingDelete(null);
        }}
        title={
          layerPendingDelete
            ? `Delete layer "${layerPendingDelete.name}"?`
            : "Delete layer?"
        }
        description="The layer and its keyframes will be removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (layerPendingDelete) {
            deleteLayer(layerPendingDelete.id);
          }
        }}
      />
    </div>
  );
}
