"use client";

import { useState } from "react";
import { Music, Trash2 } from "lucide-react";
import type { AudioTrack } from "@open-effects/shared-types";
import { AudioStrip } from "../AudioStrip";
import { ConfirmDialog } from "../ConfirmDialog";

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

  if (side === "left") {
    return (
      <div
        data-testid="audio-lane-row"
        className="flex items-center gap-1 border-b border-[#2d2d2d] px-2 text-[11px] text-[#8a8a8a]"
        style={{ height: ROW_H }}
      >
        {/* Placeholder for caret column alignment (matches scene/layer rows) */}
        <span className="flex size-6 shrink-0 items-center justify-center">
          <Music className="size-3.5 opacity-40" />
        </span>
        <span className="w-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate" title={trackLabel}>
          {trackLabel ?? "Audio"}
        </span>
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
                const { id, path } = JSON.parse(raw) as {
                  id: string;
                  path: string;
                };
                onAssetDrop({ id, path });
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
        probedDurationFrames={track.trimEnd}
        sceneOffsetFrames={sceneOffsetFrames}
      />
    </div>
  );
}
