"use client";

import { ChevronDown, ChevronRight, Music } from "lucide-react";

const ROW_H = 28;

interface AudioGroupHeaderProps {
  expanded: boolean;
  onToggle: () => void;
  count: number;
  onAssetDrop: (asset: { id: string; path: string }) => void;
  /** Side: "left" for the label rail, "right" for the drop-zone area */
  side: "left" | "right";
}

export function AudioGroupHeader({
  expanded,
  onToggle,
  count,
  onAssetDrop,
  side,
}: AudioGroupHeaderProps) {
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-asset");
    if (!raw) return;
    const { id, path } = JSON.parse(raw) as { id: string; path: string };
    onAssetDrop({ id, path });
  }

  if (side === "left") {
    return (
      <div
        data-testid="audio-group-header"
        className="flex items-center gap-1 border-b border-[#2d2d2d] px-2 text-[11px] text-[#8a8a8a]"
        style={{ height: ROW_H }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded text-[#ccc] hover:bg-[#3a3a3a]"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse audio group" : "Expand audio group"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
        <span className="w-5 shrink-0" aria-hidden />
        <Music className="size-3.5 shrink-0 opacity-60" />
        <span className="min-w-0 flex-1 truncate pl-1">Audio</span>
        {count > 0 && (
          <span className="shrink-0 rounded-full bg-[#3a3a3a] px-1.5 py-0.5 text-[9px] tabular-nums text-[#aaa]">
            {count}
          </span>
        )}
      </div>
    );
  }

  // Right side: drop zone header row
  return (
    <div
      className="relative border-b border-[#2d2d2d] bg-[#181c20]"
      style={{ height: ROW_H }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    />
  );
}
