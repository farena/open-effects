"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioTrack, VolumeKeyframe } from "@open-effects/shared-types";
import { Waveform } from "./WavesurferLazy";
import { useEditorStore } from "@/editor/store";
import { toast } from "sonner";

type StripDragMode = "move" | "trimLeft" | "trimRight" | null;

interface AudioStripProps {
  track: AudioTrack;
  trackName?: string;
  totalFrames: number;
  timelineWidthPx: number;
  pxPerFrame: number;
  probedDurationFrames?: number;
  sceneOffsetFrames?: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

// ---------------------------------------------------------------------------
// VolumeKeyframeDot — draggable dot rendered inside AudioStrip body.
// Placed here (rather than Timeline.tsx) so we can use the strip's own local
// coordinate system (kf.frame is local to the track's trimStart..trimEnd span)
// without needing to pass extra coordinate conversion props through Timeline.
// ---------------------------------------------------------------------------

interface VolumeKeyframeDotProps {
  trackId: string;
  kf: VolumeKeyframe;
  trackLocalDuration: number;
  stripWidthPx: number;
}

function VolumeKeyframeDot({
  trackId,
  kf,
  trackLocalDuration,
  stripWidthPx,
}: VolumeKeyframeDotProps) {
  const moveVolumeKeyframe = useEditorStore((s) => s.moveVolumeKeyframe);
  const [dragFrame, setDragFrame] = useState<number | null>(null);

  const dragState = useRef<{
    startX: number;
    originalFrame: number;
    pxPerFrame: number;
  } | null>(null);

  const displayFrame = dragFrame !== null ? dragFrame : kf.frame;
  const leftPx =
    trackLocalDuration > 0
      ? (displayFrame / trackLocalDuration) * stripWidthPx
      : 0;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      // Prevent strip body drag from firing
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const pxPerFrame =
        trackLocalDuration > 0 ? stripWidthPx / trackLocalDuration : 1;
      dragState.current = {
        startX: e.clientX,
        originalFrame: kf.frame,
        pxPerFrame,
      };
    },
    [kf.frame, trackLocalDuration, stripWidthPx],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragState.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const deltaFrames = dx / d.pxPerFrame;
      const next = Math.round(
        clamp(d.originalFrame + deltaFrames, 0, trackLocalDuration),
      );
      setDragFrame(next);
    },
    [trackLocalDuration],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragState.current;
      if (!d) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      dragState.current = null;
      setDragFrame((current) => {
        if (current !== null && current !== d.originalFrame) {
          moveVolumeKeyframe(trackId, d.originalFrame, current);
        }
        return null;
      });
    },
    [trackId, moveVolumeKeyframe],
  );

  return (
    <div
      data-testid="volume-keyframe-dot"
      className="absolute top-1/2 z-[2] size-2.5 cursor-grab rounded-full bg-primary shadow-sm active:cursor-grabbing"
      style={{
        left: `${leftPx}px`,
        transform: "translate(-50%, -50%)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title={`Volume keyframe @ frame ${kf.frame} · value ${kf.value.toFixed(2)}`}
    />
  );
}

export function AudioStrip({
  track,
  trackName,
  totalFrames,
  timelineWidthPx,
  pxPerFrame,
  probedDurationFrames,
  sceneOffsetFrames = 0,
}: AudioStripProps) {
  const moveAudioTrack = useEditorStore((s) => s.moveAudioTrack);
  const trimAudioTrack = useEditorStore((s) => s.trimAudioTrack);
  const selectAudioTrack = useEditorStore((s) => s.selectAudioTrack);
  const splitAudioTrack = useEditorStore((s) => s.splitAudioTrack);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const selectedAudioTrackId = useEditorStore((s) => s.selectedAudioTrackId);
  const isSelected = selectedAudioTrackId === track.id;

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
      if (mode === "move") {
        selectAudioTrack(track.id);
      }
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
    [
      track.id,
      track.startFrame,
      track.trimStart,
      track.trimEnd,
      selectAudioTrack,
    ],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      // Stop bubbling so the timeline tracks container does not also
      // re-seek the playhead while we are dragging the strip / its handles.
      e.stopPropagation();
      const dx = e.clientX - d.startX;
      const dFrames = pxToFrameDelta(dx);

      if (d.mode === "move") {
        const nextStart = Math.max(0, d.initialStartFrame + dFrames);
        moveAudioTrack(track.id, nextStart);
      } else if (d.mode === "trimLeft") {
        // Anchor the right edge: move startFrame by the same delta as trimStart
        // so the strip's right edge stays put while the left edge follows the
        // cursor (DAW convention). Clamp so neither trimStart nor startFrame
        // can go below 0, and so trimStart stays below trimEnd.
        const minDelta = Math.max(-d.initialTrimStart, -d.initialStartFrame);
        const maxDelta = d.initialTrimEnd - 1 - d.initialTrimStart;
        const trimDelta = clamp(dFrames, minDelta, maxDelta);
        const newTrimStart = d.initialTrimStart + trimDelta;
        const newStartFrame = d.initialStartFrame + trimDelta;
        trimAudioTrack(track.id, newTrimStart, d.initialTrimEnd);
        moveAudioTrack(track.id, newStartFrame);
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

  const handleSplit = useCallback(() => {
    const splitFrameLocal = currentFrame - (sceneOffsetFrames + track.startFrame);
    const span = track.trimEnd - track.trimStart;
    if (splitFrameLocal <= 0 || splitFrameLocal >= span) {
      toast.warning("Move playhead inside the strip to split.");
      return;
    }
    splitAudioTrack(track.id, splitFrameLocal);
  }, [
    currentFrame,
    sceneOffsetFrames,
    track.startFrame,
    track.trimEnd,
    track.trimStart,
    track.id,
    splitAudioTrack,
  ]);

  // Keyboard shortcut: S to split when this track is selected
  useEffect(() => {
    if (!isSelected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "s" && e.key !== "S") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isTextEditingTarget(e.target)) return;
      e.preventDefault();
      handleSplit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSelected, handleSplit]);

  return (
    <div
      data-testid="audio-strip"
      className={`absolute top-1.5 flex h-[calc(100%-12px)] min-w-[6px] items-stretch overflow-hidden rounded-sm border border-black/40 shadow-sm${isSelected ? " ring-2 ring-white/80" : ""}`}
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
        className="relative flex min-w-0 flex-1 cursor-grab select-none flex-col justify-center overflow-hidden px-1"
        onPointerDown={(e) => onPointerDown(e, "move")}
      >
        <span className="truncate text-[10px] font-medium leading-none text-white/90">
          {label}
        </span>
        <Waveform src={track.assetPath} height={24} />
        {(track.volumeKeyframes ?? []).map((kf) => (
          <VolumeKeyframeDot
            key={kf.frame}
            trackId={track.id}
            kf={kf}
            trackLocalDuration={track.trimEnd - track.trimStart}
            stripWidthPx={widthPx}
          />
        ))}
      </div>

      <div
        className="w-1.5 shrink-0 cursor-ew-resize rounded-r-sm bg-black/25 hover:bg-black/40"
        role="presentation"
        onPointerDown={(e) => onPointerDown(e, "trimRight")}
      />
    </div>
  );
}
