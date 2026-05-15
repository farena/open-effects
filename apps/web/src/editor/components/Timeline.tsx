"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type ReactNode,
} from "react";
import {
  Eye,
  EyeOff,
  Maximize,
  Pause,
  Play,
  SkipBack,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Trash2,
} from "lucide-react";
import { playerControl } from "@/editor/playerControl";
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
  selectActiveAudioTrack,
  selectActiveAudioTrackSceneId,
  selectAudioAnimatedProperties,
} from "@/editor/selectors";
import { PROPERTIES } from "@open-effects/runtime";
import type { AudioTrack, Layer, Scene } from "@open-effects/shared-types";
import { AudioGroupHeader } from "./audio/AudioGroupHeader";
import { AudioLaneRow } from "./audio/AudioLaneRow";
import { SortableLayerRow } from "./timeline/SortableLayerRow";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  probeAudioDuration,
  secondsToFrames,
} from "@/editor/lib/probeAudioDuration";

const DEFAULT_PX_PER_FRAME = 4;
const MIN_PX_PER_FRAME = 0.35;
const MAX_PX_PER_FRAME = 48;
const ZOOM_SLIDER_RESOLUTION = 1000;
const LN_PX_PER_FRAME_MIN = Math.log(MIN_PX_PER_FRAME);
const LN_PX_PER_FRAME_MAX = Math.log(MAX_PX_PER_FRAME);
const pxPerFrameToSlider = (px: number): number => {
  const t =
    (Math.log(px) - LN_PX_PER_FRAME_MIN) /
    (LN_PX_PER_FRAME_MAX - LN_PX_PER_FRAME_MIN);
  return Math.round(t * ZOOM_SLIDER_RESOLUTION);
};
const sliderToPxPerFrame = (slider: number): number => {
  const t = slider / ZOOM_SLIDER_RESOLUTION;
  return Math.exp(
    LN_PX_PER_FRAME_MIN + t * (LN_PX_PER_FRAME_MAX - LN_PX_PER_FRAME_MIN),
  );
};
const STORAGE_PX_PER_FRAME = "oe-timeline-px-per-frame";
const STORAGE_LAYER_PANEL_W = "oe-timeline-layer-panel-w";
const STORAGE_AUDIO_EXPANDED = "oe-timeline-audio-expanded";
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

interface KeyframeSidebarBlockProps {
  title: string;
  properties: string[];
  labelFor: (property: string) => string;
}

function KeyframeSidebarBlock({
  title,
  properties,
  labelFor,
}: KeyframeSidebarBlockProps) {
  return (
    <>
      <div
        className="flex shrink-0 items-center gap-1 border-t border-[#3a3a3a] bg-[#252525] px-2 text-[10px] font-semibold uppercase tracking-wide text-[#8a8a8a]"
        style={{ height: KEYFRAME_SIDEBAR_HEADER_H }}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </div>
      <div className="flex shrink-0 flex-col gap-1 py-1">
        {properties.map((prop) => (
          <div
            key={prop}
            className="flex shrink-0 items-center border-b border-[#2d2d2d] px-2 text-[11px] text-[#c4c4c4]"
            style={{ height: KEYFRAME_LANE_ROW_H }}
            title={labelFor(prop)}
          >
            <span className="min-w-0 flex-1 truncate pl-5 font-medium">
              {labelFor(prop)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

interface KeyframeTimelineBlockProps {
  srLabel: string;
  children: ReactNode;
}

function KeyframeTimelineBlock({
  srLabel,
  children,
}: KeyframeTimelineBlockProps) {
  return (
    <div className="border-t border-[#3a3a3a] bg-[#202020]">
      <div
        className="flex items-center border-b border-[#2d2d2d] px-2 text-[10px] font-semibold uppercase tracking-wide text-[#8a8a8a]"
        style={{ height: KEYFRAME_SIDEBAR_HEADER_H }}
      >
        <span className="sr-only">{srLabel}</span>
      </div>
      <div className="flex flex-col gap-1 py-1">{children}</div>
    </div>
  );
}

function propertyDisplayLabel(property: string): string {
  return PROPERTIES[property]?.label ?? property;
}

function audioPropertyDisplayLabel(property: string): string {
  if (property === "volume") return "Volume";
  return property;
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

/**
 * Frames that scene `i` (i ≥ 1) eats from the preceding scene's tail because
 * of its incoming transition. Mirrors `runtime/lib/offset.ts` so the Timeline
 * lays out scenes the same way `TransitionSeries` renders them.
 */
function sceneTransitionOverlap(sc: Scene, index: number): number {
  if (index === 0) return 0;
  const t = sc.transitionIn;
  if (!t || t.type === "none") return 0;
  return t.durationFrames;
}

function computeSceneStarts(sorted: Scene[]): number[] {
  return sorted.reduce<number[]>((acc, sc, i) => {
    if (i === 0) {
      acc.push(0);
      return acc;
    }
    const prevStart = acc[i - 1]!;
    const prevDur = sorted[i - 1]!.durationFrames;
    acc.push(prevStart + prevDur - sceneTransitionOverlap(sc, i));
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
// AudioPropertyLane — keyframe dots for one animated audio property.
// kf.frame is local to the track (0..trimEnd-trimStart). Dots are positioned
// in global frames as `sceneOffset + track.startFrame + kf.frame`. On drop,
// the new global frame is converted back to track-local for moveVolumeKeyframe.
// ---------------------------------------------------------------------------

interface AudioPropertyLaneProps {
  property: "volume";
  track: AudioTrack;
  sceneOffset: number;
  total: number;
  timelineWidthPx: number;
}

function AudioPropertyLane({
  property,
  track,
  sceneOffset,
  total,
  timelineWidthPx,
}: AudioPropertyLaneProps) {
  const moveVolumeKeyframe = useEditorStore((s) => s.moveVolumeKeyframe);
  const keyframes = property === "volume" ? (track.volumeKeyframes ?? []) : [];
  const trackLocalSpan = Math.max(0, track.trimEnd - track.trimStart);

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
      const globalOriginal = sceneOffset + track.startFrame + kfFrame;
      if (draggedGlobal === globalOriginal) return;
      const targetLocal = Math.round(
        clamp(
          draggedGlobal - sceneOffset - track.startFrame,
          0,
          trackLocalSpan,
        ),
      );
      if (targetLocal === kfFrame) return;
      moveVolumeKeyframe(track.id, kfFrame, targetLocal);
    },
    [
      dragFrames,
      sceneOffset,
      track.id,
      track.startFrame,
      trackLocalSpan,
      moveVolumeKeyframe,
    ],
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
            : sceneOffset + track.startFrame + kf.frame;
        const leftPx = total > 0 ? (globalFrame / total) * timelineWidthPx : 0;

        return (
          <div
            key={kf.frame}
            data-testid="audio-keyframe-dot"
            className="absolute top-1/2 z-[1] size-2.5 cursor-grab rounded-full bg-emerald-400 active:cursor-grabbing"
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
      style={{
        height: RULER_H,
        width: widthPx,
        pointerEvents: "none",
      }}
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
      // Prevent the timeline tracks container from also seeking the playhead
      // while we are actively dragging a layer bar / trim handle.
      e.stopPropagation();
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
  onMediaDrop?: (asset: {
    id: string;
    path: string;
    filename: string;
    type: "image" | "video";
  }) => void;
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
  onMediaDrop,
}: SceneBarProps) {
  const setSceneDuration = useEditorStore((s) => s.setSceneDuration);
  const adjustSceneBoundaryAt = useEditorStore((s) => s.adjustSceneBoundaryAt);

  const globalStart = sceneStarts[sceneIndex]!;
  const span = Math.max(1, scene.durationFrames);
  const leftPx = total > 0 ? (globalStart / total) * timelineWidthPx : 0;
  const widthPx = total > 0 ? (span / total) * timelineWidthPx : 0;

  // Width (in px) of the overlap with the previous scene caused by this scene's
  // incoming transition. The overlap region spans the first `transitionDur`
  // frames of this scene AND the last `transitionDur` frames of the previous.
  const transitionDurFrames = sceneTransitionOverlap(scene, sceneIndex);
  const transitionWidthPx =
    total > 0 ? (transitionDurFrames / total) * timelineWidthPx : 0;

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
      // Same rationale as in LayerBar: don't bubble move events to the
      // tracks container, which would otherwise re-seek the playhead.
      e.stopPropagation();
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

  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!onMediaDrop) return;
      // Only accept our own asset drag payload.
      if (!e.dataTransfer.types.includes("application/x-asset")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!dragOver) setDragOver(true);
    },
    [onMediaDrop, dragOver],
  );

  const handleDragLeave = useCallback(() => {
    if (dragOver) setDragOver(false);
  }, [dragOver]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!onMediaDrop) return;
      e.preventDefault();
      setDragOver(false);
      const raw = e.dataTransfer.getData("application/x-asset");
      if (!raw) return;
      try {
        const payload = JSON.parse(raw) as {
          id: string;
          path: string;
          filename?: string;
          type?: string;
        };
        if (payload.type !== "image" && payload.type !== "video") return;
        onMediaDrop({
          id: payload.id,
          path: payload.path,
          filename: payload.filename ?? payload.path.split("/").pop() ?? "",
          type: payload.type,
        });
      } catch {
        /* malformed payload — ignore */
      }
    },
    [onMediaDrop],
  );

  return (
    <div
      className="relative flex items-center border-b border-[#2d2d2d]"
      style={{ height: ROW_H, width: timelineWidthPx }}
    >
      {transitionWidthPx > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1.5 h-[calc(100%-12px)] rounded-sm"
          style={{
            left: leftPx - transitionWidthPx / 2,
            width: transitionWidthPx,
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(245,215,66,0.55) 0 4px, rgba(245,215,66,0) 4px 8px)",
            borderLeft: "1px solid rgba(245,215,66,0.6)",
            borderRight: "1px solid rgba(245,215,66,0.6)",
            zIndex: 1,
          }}
          title={`Transition: ${scene.transitionIn?.type ?? ""} · ${transitionDurFrames}f`}
        />
      ) : null}
      <div
        data-testid="scene-bar"
        className={[
          "absolute top-1.5 flex h-[calc(100%-12px)] min-w-[8px] cursor-default items-stretch rounded-sm border border-black/50 shadow-sm",
          isSelected ? "ring-1 ring-violet-300/60" : "",
          dragOver ? "ring-2 ring-amber-300/80" : "",
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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

// Isolated readout for the header timecode. Subscribes to currentFrame so
// the rest of Timeline doesn't re-render every rAF tick during playback.
function TimecodeReadout({ fps, total }: { fps: number; total: number }) {
  const currentFrame = useEditorStore((s) => s.currentFrame);
  return (
    <>
      <span className="font-mono text-xs tabular-nums text-[hsl(var(--timeline-hi))]">
        {formatTimecode(currentFrame, fps)}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {currentFrame} / {Math.max(0, total - 1)} · {total}f
      </span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export function Timeline() {
  const scenes = useEditorStore((s) => s.project.scenes);
  const fps = useEditorStore((s) => s.project.fps);
  // Do NOT subscribe to currentFrame here — see TimecodeReadout and the
  // playhead refs below. During playback the rAF loop fires setCurrentFrame
  // ~30 times/s; if Timeline subscribed to it, the entire tree would
  // re-render every frame and make playback choppy.
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const play = useEditorStore((s) => s.play);
  const pause = useEditorStore((s) => s.pause);
  const loopStart = useEditorStore((s) => s.loopStart);
  const loopEnd = useEditorStore((s) => s.loopEnd);
  const setLoopStart = useEditorStore((s) => s.setLoopStart);
  const setLoopEnd = useEditorStore((s) => s.setLoopEnd);
  const clearLoopRange = useEditorStore((s) => s.clearLoopRange);
  const volume = useEditorStore((s) => s.volume);
  const setVolume = useEditorStore((s) => s.setVolume);
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
  const activeAudioTrack = useEditorStore(selectActiveAudioTrack);
  const activeAudioTrackSceneId = useEditorStore(selectActiveAudioTrackSceneId);
  const audioAnimatedProps = useEditorStore(selectAudioAnimatedProperties);
  const addLayer = useEditorStore((s) => s.addLayer);
  const addMediaLayer = useEditorStore((s) => s.addMediaLayer);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);
  const addAudioTrack = useEditorStore((s) => s.addAudioTrack);
  const removeAudioTrack = useEditorStore((s) => s.removeAudioTrack);
  const reorderLayers = useEditorStore((s) => s.reorderLayers);
  const reorderAudioTracks = useEditorStore((s) => s.reorderAudioTracks);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleReorderLayersEnd = useCallback(
    (sceneId: string, orderedIds: string[]) =>
      (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = orderedIds.indexOf(active.id as string);
        const newIndex = orderedIds.indexOf(over.id as string);
        if (oldIndex < 0 || newIndex < 0) return;
        const next = arrayMove(orderedIds, oldIndex, newIndex);
        reorderLayers(sceneId, next);
      },
    [reorderLayers],
  );

  const handleReorderAudioEnd = useCallback(
    (sceneId: string, orderedIds: string[]) =>
      (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = orderedIds.indexOf(active.id as string);
        const newIndex = orderedIds.indexOf(over.id as string);
        if (oldIndex < 0 || newIndex < 0) return;
        const next = arrayMove(orderedIds, oldIndex, newIndex);
        reorderAudioTracks(sceneId, next);
      },
    [reorderAudioTracks],
  );

  const [expandedByScene, setExpandedByScene] = useState<
    Record<string, boolean>
  >({});

  const [audioExpanded, setAudioExpanded] = useState<boolean>(true);

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
      const audioExpandedRaw = localStorage.getItem(STORAGE_AUDIO_EXPANDED);
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
      if (audioExpandedRaw) {
        try {
          const parsed = JSON.parse(audioExpandedRaw);
          if (typeof parsed === "boolean") setAudioExpanded(parsed);
        } catch {
          /* ignore malformed */
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

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_AUDIO_EXPANDED,
        JSON.stringify(audioExpanded),
      );
    } catch {
      /* ignore */
    }
  }, [audioExpanded]);

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

  const allAudioTracks = useMemo(
    () =>
      sorted.flatMap((sc, si) =>
        sc.audioTracks.map((t) => ({
          track: t,
          sceneId: sc.id,
          sceneOffset: sceneStarts[si]!,
        })),
      ),
    [sorted, sceneStarts],
  );

  const audioSceneGroups = useMemo(
    () =>
      sorted.map((sc, si) => ({
        sceneId: sc.id,
        sceneOffset: sceneStarts[si]!,
        trackIds: sc.audioTracks.map((t) => t.id),
        tracks: sc.audioTracks,
      })),
    [sorted, sceneStarts],
  );

  const trackRowCount = useMemo(() => {
    let n = 1; // project-level audio group header row (always visible)
    if (audioExpanded) n += allAudioTracks.length;
    for (const sc of sorted) {
      n += 1; // scene bar row
      if (expandedByScene[sc.id] !== false) n += sc.layers.length;
    }
    return n;
  }, [sorted, expandedByScene, audioExpanded, allAudioTracks.length]);

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

  const onRulerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      seekFromClientX(e.clientX);
    },
    [seekFromClientX],
  );

  const onRulerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return;
      seekFromClientX(e.clientX);
    },
    [seekFromClientX],
  );

  const onRulerPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget as HTMLElement;
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  // Playhead position is driven imperatively via refs + a store subscription
  // (see effect below) so the rAF-driven frame updates during playback don't
  // re-render Timeline. The initial paint just leaves left:0; the effect
  // applies the correct position synchronously after mount and on every
  // currentFrame change thereafter.
  const playheadLineRef = useRef<HTMLDivElement | null>(null);
  const playheadHandleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const apply = (frame: number) => {
      if (total <= 0) return;
      const px = (frame / total) * timelineWidthPx;
      if (playheadLineRef.current) {
        playheadLineRef.current.style.left = `${px}px`;
      }
      if (playheadHandleRef.current) {
        playheadHandleRef.current.style.left = `${px}px`;
      }
    };
    apply(useEditorStore.getState().currentFrame);
    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (state.currentFrame === prev.currentFrame) return;
      apply(state.currentFrame);
    });
    return unsubscribe;
  }, [total, timelineWidthPx]);

  // Active loop range overlay coordinates. If neither bound is set, no
  // overlay is rendered (the entire timeline is the active range). When
  // only one bound is set, the other defaults to the timeline edge.
  const hasLoopRange = total > 0 && (loopStart !== null || loopEnd !== null);
  const loopRangeStartFrame = loopStart ?? 0;
  const loopRangeEndFrame = loopEnd ?? Math.max(0, total - 1);
  const loopRangeLeftPx =
    total > 0 ? (loopRangeStartFrame / total) * timelineWidthPx : 0;
  const loopRangeWidthPx =
    total > 0
      ? ((loopRangeEndFrame - loopRangeStartFrame) / total) * timelineWidthPx
      : 0;

  const showLayerKeyframeLanes =
    activeLayer !== null && animatedProps.length > 0 && total > 0;
  const showAudioKeyframeLanes =
    activeAudioTrack !== null && audioAnimatedProps.length > 0 && total > 0;
  const showSceneKeyframeLanes =
    activeLayer === null &&
    activeAudioTrack === null &&
    activeScene !== null &&
    animatedSceneProps.length > 0 &&
    total > 0;

  const audioSceneOffset = useMemo(() => {
    if (!activeAudioTrackSceneId) return 0;
    const idx = sorted.findIndex((sc) => sc.id === activeAudioTrackSceneId);
    return idx >= 0 ? sceneStarts[idx]! : 0;
  }, [activeAudioTrackSceneId, sorted, sceneStarts]);

  const keyframeBlockHeight = showLayerKeyframeLanes
    ? keyframeSectionHeight(animatedProps.length)
    : showAudioKeyframeLanes
      ? keyframeSectionHeight(audioAnimatedProps.length)
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

  const anyLayerExpanded = useMemo(
    () => sorted.some((sc) => expandedByScene[sc.id] !== false),
    [sorted, expandedByScene],
  );

  const toggleAllLayers = useCallback(() => {
    setExpandedByScene((prev) => {
      const expandAny = !sorted.some((sc) => prev[sc.id] !== false);
      const next: Record<string, boolean> = { ...prev };
      for (const sc of sorted) next[sc.id] = expandAny;
      return next;
    });
  }, [sorted]);

  const toggleAudioExpanded = useCallback(() => {
    setAudioExpanded((prev) => !prev);
  }, []);

  const handleAudioAssetDrop = useCallback(
    async ({ id, path }: { id: string; path: string }) => {
      const targetSceneId = sorted[0]?.id;
      if (!targetSceneId) return;
      const seconds = await probeAudioDuration(path);
      const fps = useEditorStore.getState().project.fps;
      addAudioTrack(targetSceneId, {
        id,
        path,
        durationFrames: secondsToFrames(seconds, fps),
      });
    },
    [sorted, addAudioTrack],
  );

  const handleSceneMediaDrop = useCallback(
    (
      sceneId: string,
      asset: {
        id: string;
        path: string;
        filename: string;
        type: "image" | "video";
      },
    ) => {
      addMediaLayer(sceneId, {
        kind: asset.type,
        path: asset.path,
        filename: asset.filename,
      });
    },
    [addMediaLayer],
  );

  return (
    <div className="flex h-full flex-col bg-[#232323] text-[#e8e8e8]">
      {/* Header: timecode + transport + zoom */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#3a3a3a] bg-[#2a2a2a] px-2 py-1">
        <div className="me-auto flex items-baseline gap-2">
          <TimecodeReadout fps={fps} total={total} />
        </div>
        <div
          className="flex shrink-0 items-center gap-1 rounded border border-[#444] bg-[#333] px-1 py-0.5"
          title="Playback"
        >
          <button
            type="button"
            className="rounded p-0.5 text-[#ccc] hover:bg-[#444] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Skip to start"
            disabled={total === 0}
            onClick={() => {
              pause();
              setCurrentFrame(0);
            }}
          >
            <SkipBack className="size-3.5" />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-[#ccc] hover:bg-[#444] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label={isPlaying ? "Pause" : "Play"}
            aria-pressed={isPlaying}
            disabled={total === 0}
            onClick={() => (isPlaying ? pause() : play())}
          >
            {isPlaying ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
          </button>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 rounded border border-[#444] bg-[#333] px-1 py-0.5"
          title="Loop range — [ sets start, ] sets end. Click an active marker to clear."
        >
          <button
            type="button"
            className={`rounded px-1 py-0.5 font-mono text-xs leading-none hover:bg-[#444] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent ${
              loopStart !== null ? "text-[#f5d742]" : "text-[#ccc]"
            }`}
            aria-label={
              loopStart !== null
                ? `Clear loop start (frame ${loopStart})`
                : "Set loop start"
            }
            aria-pressed={loopStart !== null}
            disabled={total === 0}
            onClick={() =>
              setLoopStart(
                loopStart !== null
                  ? null
                  : useEditorStore.getState().currentFrame,
              )
            }
          >
            [
          </button>
          <button
            type="button"
            className={`rounded px-1 py-0.5 font-mono text-xs leading-none hover:bg-[#444] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent ${
              loopEnd !== null ? "text-[#f5d742]" : "text-[#ccc]"
            }`}
            aria-label={
              loopEnd !== null
                ? `Clear loop end (frame ${loopEnd})`
                : "Set loop end"
            }
            aria-pressed={loopEnd !== null}
            disabled={total === 0}
            onClick={() =>
              setLoopEnd(
                loopEnd !== null
                  ? null
                  : useEditorStore.getState().currentFrame,
              )
            }
          >
            ]
          </button>
          {(loopStart !== null || loopEnd !== null) && (
            <button
              type="button"
              className="rounded px-1 py-0.5 text-[10px] leading-none text-[#8a8a8a] hover:bg-[#444] hover:text-white"
              aria-label="Clear loop range"
              onClick={clearLoopRange}
            >
              ×
            </button>
          )}
        </div>
        <div
          className="flex shrink-0 items-center gap-1 rounded border border-[#444] bg-[#333] px-1 py-0.5"
          title="Volume"
        >
          <button
            type="button"
            className="rounded p-0.5 text-[#ccc] hover:bg-[#444] hover:text-white"
            aria-label={volume === 0 ? "Unmute" : "Mute"}
            onClick={() => setVolume(volume === 0 ? 1 : 0)}
          >
            {volume === 0 ? (
              <VolumeX className="size-3.5" />
            ) : (
              <Volume2 className="size-3.5" />
            )}
          </button>
          <input
            aria-label="Volume"
            className="h-1 w-16 cursor-pointer accent-[hsl(var(--primary))]"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-[#444] bg-[#333] p-1 text-[#ccc] hover:bg-[#444] hover:text-white disabled:opacity-40 disabled:hover:bg-[#333]"
          aria-label="Fullscreen"
          disabled={total === 0}
          onClick={() => playerControl.requestFullscreen()}
          title="Fullscreen"
        >
          <Maximize className="size-3.5" />
        </button>
        <div
          className="flex shrink-0 items-center gap-1 rounded border border-[#444] bg-[#333] px-1 py-0.5"
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
            className="h-1 w-32 cursor-pointer accent-[hsl(var(--primary))]"
            type="range"
            min={0}
            max={ZOOM_SLIDER_RESOLUTION}
            step={1}
            value={pxPerFrameToSlider(pxPerFrame)}
            onChange={(e) =>
              setPxPerFrame(
                clamp(
                  sliderToPxPerFrame(parseFloat(e.target.value)),
                  MIN_PX_PER_FRAME,
                  MAX_PX_PER_FRAME,
                ),
              )
            }
            title={`${(pxPerFrame * fps).toFixed(1)} px/s`}
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
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center rounded text-[#aaa] hover:bg-[#3a3a3a] hover:text-white"
                aria-label={
                  anyLayerExpanded ? "Collapse all layers" : "Expand all layers"
                }
                title={
                  anyLayerExpanded ? "Collapse all layers" : "Expand all layers"
                }
                onClick={toggleAllLayers}
              >
                {anyLayerExpanded ? (
                  <ChevronsDownUp className="size-3.5" />
                ) : (
                  <ChevronsUpDown className="size-3.5" />
                )}
              </button>
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
                const sceneKeyframesHere =
                  showSceneKeyframeLanes && activeScene?.id === scene.id;
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
                    {sceneKeyframesHere && activeScene && (
                      <KeyframeSidebarBlock
                        title={`Scene keyframes · ${activeScene.name}`}
                        properties={animatedSceneProps}
                        labelFor={propertyDisplayLabel}
                      />
                    )}
                    {expanded && (
                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleReorderLayersEnd(
                          scene.id,
                          layersInScene.map((l) => l.id),
                        )}
                      >
                        <SortableContext
                          items={layersInScene.map((l) => l.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {layersInScene.map((layer, i) => {
                            const revIndex = layersInScene.length - i;
                            const selected = selectedLayerId === layer.id;
                            const color = labelColorForLayerId(layer.id);
                            const layerKeyframesHere =
                              showLayerKeyframeLanes &&
                              activeLayer?.id === layer.id;
                            return (
                              <SortableLayerRow
                                key={layer.id}
                                layer={layer}
                                revIndex={revIndex}
                                isSelected={selected}
                                labelColor={color}
                                onSelect={() => selectLayer(layer.id)}
                                onToggleVisible={() =>
                                  toggleLayerVisible(layer.id)
                                }
                                onRequestDelete={() =>
                                  setLayerPendingDelete({
                                    id: layer.id,
                                    name: layer.name,
                                  })
                                }
                                trailing={
                                  layerKeyframesHere && activeLayer ? (
                                    <KeyframeSidebarBlock
                                      title={`Keyframes · ${activeLayer.name}`}
                                      properties={animatedProps}
                                      labelFor={propertyDisplayLabel}
                                    />
                                  ) : null
                                }
                              />
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    )}
                  </Fragment>
                );
              })}
              <AudioGroupHeader
                side="left"
                expanded={audioExpanded}
                onToggle={toggleAudioExpanded}
                count={allAudioTracks.length}
                onAssetDrop={handleAudioAssetDrop}
              />
              {audioExpanded &&
                audioSceneGroups.map((group) => {
                  if (group.trackIds.length === 0) return null;
                  return (
                    <DndContext
                      key={`audio-dnd-${group.sceneId}`}
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleReorderAudioEnd(
                        group.sceneId,
                        group.trackIds,
                      )}
                    >
                      <SortableContext
                        items={group.trackIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {group.tracks.map((track) => {
                          const audioKeyframesHere =
                            showAudioKeyframeLanes &&
                            activeAudioTrack?.id === track.id;
                          return (
                            <Fragment key={track.id}>
                              <AudioLaneRow
                                track={track}
                                sceneId={group.sceneId}
                                sceneOffsetFrames={group.sceneOffset}
                                total={total}
                                timelineWidthPx={timelineWidthPx}
                                pxPerFrame={pxPerFrame}
                                side="left"
                                onDelete={() => removeAudioTrack(track.id)}
                              />
                              {audioKeyframesHere && activeAudioTrack && (
                                <KeyframeSidebarBlock
                                  title={`Audio keyframes · ${
                                    activeAudioTrack.assetPath
                                      ?.split("/")
                                      .pop() ?? "Audio"
                                  }`}
                                  properties={audioAnimatedProps}
                                  labelFor={audioPropertyDisplayLabel}
                                />
                              )}
                            </Fragment>
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  );
                })}
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
              >
                <div
                  className="sticky top-0 z-[5] select-none"
                  style={{
                    height: RULER_H,
                    width: timelineWidthPx,
                    cursor: "ew-resize",
                  }}
                  onPointerDown={onRulerPointerDown}
                  onPointerMove={onRulerPointerMove}
                  onPointerUp={onRulerPointerUp}
                  onPointerCancel={onRulerPointerUp}
                >
                  <TimeRuler
                    total={total}
                    fps={fps}
                    widthPx={timelineWidthPx}
                  />
                  {total > 0 && (
                    <button
                      ref={playheadHandleRef}
                      type="button"
                      aria-label="Playhead"
                      className="pointer-events-auto absolute top-0 z-[8] flex -translate-x-1/2 flex-col items-center bg-transparent p-0"
                      style={{ left: 0 }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        playheadDrag.current = true;
                        (e.target as HTMLElement).setPointerCapture(
                          e.pointerId,
                        );
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
                  )}
                </div>

                {sorted.map((scene, si) => {
                  const expanded = expandedByScene[scene.id] !== false;
                  const off = sceneStarts[si]!;
                  const sceneKeyframesHere =
                    showSceneKeyframeLanes && activeScene?.id === scene.id;
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
                        onMediaDrop={(asset) =>
                          handleSceneMediaDrop(scene.id, asset)
                        }
                      />
                      {sceneKeyframesHere && activeScene && (
                        <KeyframeTimelineBlock
                          srLabel={`Scene keyframes timeline for ${activeScene.name}`}
                        >
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
                        </KeyframeTimelineBlock>
                      )}
                      {expanded &&
                        [...scene.layers]
                          .sort((a, b) => a.order - b.order)
                          .map((layer) => {
                            const layerKeyframesHere =
                              showLayerKeyframeLanes &&
                              activeLayer?.id === layer.id;
                            return (
                              <Fragment key={layer.id}>
                                <LayerBar
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
                                {layerKeyframesHere && activeLayer && (
                                  <KeyframeTimelineBlock
                                    srLabel={`Keyframes timeline for layer ${activeLayer.name}`}
                                  >
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
                                  </KeyframeTimelineBlock>
                                )}
                              </Fragment>
                            );
                          })}
                    </Fragment>
                  );
                })}

                {/* Project-level Audio group (right side drop target) */}
                <AudioGroupHeader
                  side="right"
                  expanded={audioExpanded}
                  onToggle={toggleAudioExpanded}
                  count={allAudioTracks.length}
                  onAssetDrop={handleAudioAssetDrop}
                />
                {audioExpanded &&
                  allAudioTracks.map(({ track, sceneId, sceneOffset }) => {
                    const audioKeyframesHere =
                      showAudioKeyframeLanes &&
                      activeAudioTrack?.id === track.id;
                    return (
                      <Fragment key={track.id}>
                        <AudioLaneRow
                          track={track}
                          sceneId={sceneId}
                          sceneOffsetFrames={sceneOffset}
                          total={total}
                          timelineWidthPx={timelineWidthPx}
                          pxPerFrame={pxPerFrame}
                          side="right"
                          onDelete={() => removeAudioTrack(track.id)}
                          onAssetDrop={handleAudioAssetDrop}
                        />
                        {audioKeyframesHere && activeAudioTrack && (
                          <KeyframeTimelineBlock
                            srLabel={`Audio keyframes timeline for track ${
                              activeAudioTrack.assetPath?.split("/").pop() ??
                              "Audio"
                            }`}
                          >
                            {audioAnimatedProps.map((prop) => (
                              <AudioPropertyLane
                                key={prop}
                                property={prop}
                                track={activeAudioTrack}
                                sceneOffset={audioSceneOffset}
                                total={total}
                                timelineWidthPx={timelineWidthPx}
                              />
                            ))}
                          </KeyframeTimelineBlock>
                        )}
                      </Fragment>
                    );
                  })}
              </div>

              {total > 0 && (
                <>
                  {hasLoopRange && loopRangeWidthPx > 0 && (
                    <div
                      className="pointer-events-none absolute top-0 z-[6] border-x border-[#f5d742]/60 bg-[#f5d742]/15"
                      style={{
                        left: loopRangeLeftPx,
                        width: loopRangeWidthPx,
                        height: playheadTracksHeight,
                      }}
                    />
                  )}
                  <div
                    ref={playheadLineRef}
                    className="pointer-events-none absolute top-0 z-[7]"
                    style={{
                      left: 0,
                      height: playheadTracksHeight,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="h-full w-px bg-[#e63946]" />
                  </div>
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
