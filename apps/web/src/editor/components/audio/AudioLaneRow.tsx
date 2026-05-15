"use client";

import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Music,
  Scissors,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import type { AudioTrack } from "@open-effects/shared-types";
import { AudioStrip } from "../AudioStrip";
import { ConfirmDialog } from "../ConfirmDialog";
import { useEditorStore } from "@/editor/store";
import {
  probeAudioDuration,
  secondsToFrames,
} from "@/editor/lib/probeAudioDuration";

const ROW_H = 28;

interface AudioLaneRowProps {
  track: AudioTrack;
  sceneId: string;
  sceneOffsetFrames: number;
  total: number;
  timelineWidthPx: number;
  pxPerFrame: number;
  side: "left" | "right";
  onDelete: () => void;
  onAssetDrop?: (asset: { id: string; path: string }) => void;
}

export function AudioLaneRow({
  track,
  sceneOffsetFrames,
  total,
  timelineWidthPx,
  pxPerFrame,
  side,
  onDelete,
  onAssetDrop,
}: AudioLaneRowProps) {
  const trackLabel =
    track.assetPath ? track.assetPath.split("/").pop() : undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectAudioTrack = useEditorStore((s) => s.selectAudioTrack);
  const selectedAudioTrackId = useEditorStore((s) => s.selectedAudioTrackId);
  const splitAudioTrack = useEditorStore((s) => s.splitAudioTrack);
  const toggleAudioTrackMute = useEditorStore((s) => s.toggleAudioTrackMute);
  const currentFrame = useEditorStore((s) => s.currentFrame);

  const {
    attributes: sortableAttributes,
    listeners: sortableListeners,
    setNodeRef: setSortableNodeRef,
    transform: sortableTransform,
    transition: sortableTransition,
    isDragging: sortableIsDragging,
  } = useSortable({ id: track.id });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(sortableTransform),
    transition: sortableTransition,
    opacity: sortableIsDragging ? 0.5 : 1,
  };
  const fps = useEditorStore((s) => s.project.fps);
  const isSelected = selectedAudioTrackId === track.id;

  // Probe the asset's true duration once per (path, fps) so the right-trim
  // handle can extend the strip up to the original media length, not just
  // the current trimEnd.
  const [probedFrames, setProbedFrames] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!track.assetPath) {
      setProbedFrames(null);
      return;
    }
    probeAudioDuration(track.assetPath)
      .then((seconds) => {
        if (cancelled) return;
        setProbedFrames(secondsToFrames(seconds, fps));
      })
      .catch(() => {
        if (!cancelled) setProbedFrames(null);
      });
    return () => {
      cancelled = true;
    };
  }, [track.assetPath, fps]);

  function handleSplit() {
    const splitFrameLocal =
      currentFrame - (sceneOffsetFrames + track.startFrame);
    const span = track.trimEnd - track.trimStart;
    if (splitFrameLocal <= 0 || splitFrameLocal >= span) {
      toast.warning("Move playhead inside the strip to split.");
      return;
    }
    splitAudioTrack(track.id, splitFrameLocal);
  }

  if (side === "left") {
    return (
      <div
        ref={setSortableNodeRef}
        data-testid="audio-lane-row"
        className={[
          "flex items-center gap-1 border-b border-[#2d2d2d] px-2 text-[11px]",
          isSelected ? "bg-[#3d4a5c] text-white" : "text-[#8a8a8a] hover:bg-[#2f2f2f]",
        ].join(" ")}
        style={{ ...sortableStyle, height: ROW_H }}
      >
        <span
          {...sortableAttributes}
          {...sortableListeners}
          className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-[#888] hover:bg-[#3a3a3a] hover:text-white active:cursor-grabbing"
          aria-label="Drag to reorder audio track"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3" />
        </span>
        <span className="flex size-6 shrink-0 items-center justify-center">
          <Music className="size-3.5 opacity-40" />
        </span>
        <span className="w-5 shrink-0" aria-hidden />
        <span
          className="min-w-0 flex-1 cursor-pointer truncate"
          title={trackLabel}
          role="button"
          tabIndex={0}
          onClick={() => selectAudioTrack(track.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              selectAudioTrack(track.id);
            }
          }}
        >
          {trackLabel ?? "Audio"}
        </span>
        {/* Mute toggle — sits to the LEFT of scissors. */}
        <button
          type="button"
          data-testid="audio-lane-mute"
          className="shrink-0 rounded p-0.5 text-[#aaa] hover:bg-[#3a3a3a] hover:text-white"
          aria-label={track.muted ? "Unmute audio track" : "Mute audio track"}
          aria-pressed={track.muted}
          title={track.muted ? "Unmute" : "Mute"}
          onClick={(e) => {
            e.stopPropagation();
            toggleAudioTrackMute(track.id);
          }}
        >
          {track.muted ? (
            <VolumeX className="size-3" />
          ) : (
            <Volume2 className="size-3" />
          )}
        </button>
        {/* Scissors button — split at playhead. Sits to the LEFT of trash. */}
        <button
          type="button"
          data-testid="audio-lane-scissors"
          className="shrink-0 rounded p-0.5 text-[#aaa] hover:bg-[#3a3a3a] hover:text-white"
          aria-label="Split audio track at playhead"
          title="Split at playhead (S)"
          onClick={(e) => {
            e.stopPropagation();
            handleSplit();
          }}
        >
          <Scissors className="size-3" />
        </button>
        {/* Trash button mirroring layer rows (same column, same hover color) */}
        <button
          type="button"
          data-testid="audio-lane-trash"
          className="shrink-0 rounded p-0.5 text-[#aaa] hover:bg-[#5c2b2b] hover:text-white"
          aria-label="Remove audio track"
          title="Remove audio track"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
        >
          <Trash2 className="size-3" />
        </button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Delete audio track “${trackLabel ?? "Audio"}”?`}
          description="The track and its volume keyframes will be removed. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={onDelete}
        />
      </div>
    );
  }

  // Right side: strip container — also a drop target so AC3
  // (header OR any of its lanes) is fully satisfied.
  return (
    <div
      className="relative border-b border-[#2d2d2d] bg-[#181c20]"
      style={{ height: ROW_H, width: timelineWidthPx }}
      onDragOver={onAssetDrop ? (e) => e.preventDefault() : undefined}
      onDrop={
        onAssetDrop
          ? (e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/x-asset");
              if (!raw) return;
              try {
                const payload = JSON.parse(raw) as {
                  id: string;
                  path: string;
                  type?: string;
                };
                if (payload.type !== undefined && payload.type !== "audio") {
                  return;
                }
                onAssetDrop({ id: payload.id, path: payload.path });
              } catch {
                /* malformed payload — ignore */
              }
            }
          : undefined
      }
    >
      <AudioStrip
        track={track}
        totalFrames={total}
        timelineWidthPx={timelineWidthPx}
        pxPerFrame={pxPerFrame}
        probedDurationFrames={probedFrames ?? undefined}
        sceneOffsetFrames={sceneOffsetFrames}
      />
    </div>
  );
}
