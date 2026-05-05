"use client";

import { useCallback, useRef } from "react";
import { Trash2 } from "lucide-react";
import type { AudioTrack } from "@open-effects/shared-types";
import { Waveform } from "./WavesurferLazy";
import { useEditorStore } from "@/editor/store";

type StripDragMode = "move" | "trimLeft" | "trimRight" | null;

interface AudioStripProps {
  track: AudioTrack;
  trackName?: string;
  totalFrames: number;
  timelineWidthPx: number;
  pxPerFrame: number;
  probedDurationFrames?: number;
  sceneOffsetFrames?: number;
  onDelete: () => void;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function AudioStrip({
  track,
  trackName,
  totalFrames,
  timelineWidthPx,
  pxPerFrame,
  probedDurationFrames,
  sceneOffsetFrames = 0,
  onDelete,
}: AudioStripProps) {
  const moveAudioTrack = useEditorStore((s) => s.moveAudioTrack);
  const trimAudioTrack = useEditorStore((s) => s.trimAudioTrack);

  const label =
    trackName ??
    (track.assetPath ? track.assetPath.split("/").pop() : undefined) ??
    "Audio";

  const globalStart = sceneOffsetFrames + track.startFrame;
  const leftPx =
    totalFrames > 0 ? (globalStart / totalFrames) * timelineWidthPx : 0;

  const rawWidth =
    totalFrames > 0
      ? ((track.trimEnd - track.trimStart) / totalFrames) * timelineWidthPx
      : 0;
  const widthPx = Math.max(rawWidth, 6);

  const dragRef = useRef<{
    mode: StripDragMode;
    startX: number;
    initialStartFrame: number;
    initialTrimStart: number;
    initialTrimEnd: number;
  } | null>(null);

  const pxToFrameDelta = useCallback(
    (dxPx: number) => Math.round(dxPx / pxPerFrame),
    [pxPerFrame],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, mode: StripDragMode) => {
      if (!mode) return;
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        initialStartFrame: track.startFrame,
        initialTrimStart: track.trimStart,
        initialTrimEnd: track.trimEnd,
      };
    },
    [track.startFrame, track.trimStart, track.trimEnd],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dFrames = pxToFrameDelta(dx);

      if (d.mode === "move") {
        const nextStart = Math.max(0, d.initialStartFrame + dFrames);
        moveAudioTrack(track.id, nextStart);
      } else if (d.mode === "trimLeft") {
        const newTrimStart = clamp(
          d.initialTrimStart + dFrames,
          0,
          d.initialTrimEnd - 1,
        );
        trimAudioTrack(track.id, newTrimStart, track.trimEnd);
      } else if (d.mode === "trimRight") {
        const maxTrimEnd = probedDurationFrames ?? Number.MAX_SAFE_INTEGER;
        const newTrimEnd = clamp(
          d.initialTrimEnd + dFrames,
          d.initialTrimStart + 1,
          maxTrimEnd,
        );
        trimAudioTrack(track.id, track.trimStart, newTrimEnd);
      }
    },
    [
      pxToFrameDelta,
      moveAudioTrack,
      trimAudioTrack,
      track.id,
      track.trimStart,
      track.trimEnd,
      probedDurationFrames,
    ],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  }, []);

  return (
    <div
      data-testid="audio-strip"
      className="absolute top-1.5 flex h-[calc(100%-12px)] min-w-[6px] items-stretch overflow-hidden rounded-sm border border-black/40 shadow-sm"
      style={{
        left: leftPx,
        width: widthPx,
        backgroundColor: "#3aa89b",
        opacity: 0.92,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="w-1.5 shrink-0 cursor-ew-resize rounded-l-sm bg-black/25 hover:bg-black/40"
        role="presentation"
        onPointerDown={(e) => onPointerDown(e, "trimLeft")}
      />

      <div
        className="flex min-w-0 flex-1 cursor-grab select-none flex-col justify-center overflow-hidden px-1"
        onPointerDown={(e) => onPointerDown(e, "move")}
      >
        <span className="truncate text-[10px] font-medium leading-none text-white/90">
          {label}
        </span>
        <Waveform src={track.assetPath} height={24} />
      </div>

      <div
        className="w-1.5 shrink-0 cursor-ew-resize rounded-r-sm bg-black/25 hover:bg-black/40"
        role="presentation"
        onPointerDown={(e) => onPointerDown(e, "trimRight")}
      />

      <button
        type="button"
        className="shrink-0 rounded px-0.5 text-white/70 hover:bg-black/40 hover:text-white"
        aria-label="Delete audio track"
        title="Delete audio track"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}
