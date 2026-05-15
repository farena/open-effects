"use client";

import { Fragment, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import type { Layer } from "@open-effects/shared-types";

const ROW_H = 28;

interface SortableLayerRowProps {
  layer: Layer;
  revIndex: number;
  isSelected: boolean;
  labelColor: string;
  onSelect: () => void;
  onToggleVisible: () => void;
  onRequestDelete: () => void;
  /** Optional row to render directly under (e.g. keyframe lanes block). */
  trailing?: ReactNode;
}

export function SortableLayerRow({
  layer,
  revIndex,
  isSelected,
  labelColor,
  onSelect,
  onToggleVisible,
  onRequestDelete,
  trailing,
}: SortableLayerRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Fragment>
      <div
        ref={setNodeRef}
        style={{ ...style, height: ROW_H }}
        className={[
          "flex items-center gap-1 border-b border-[#2d2d2d] px-2 text-[11px]",
          isSelected ? "bg-[#3d4a5c]" : "hover:bg-[#2f2f2f]",
        ].join(" ")}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <span
          {...attributes}
          {...listeners}
          className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-[#888] hover:bg-[#3a3a3a] hover:text-white active:cursor-grabbing"
          aria-label="Drag to reorder layer"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3" />
        </span>
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded text-[#aaa] hover:bg-[#3a3a3a] hover:text-white"
          aria-label={layer.visible ? "Hide layer" : "Show layer"}
          title={layer.visible ? "Hide layer" : "Show layer"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible();
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
          style={{ backgroundColor: labelColor }}
          title="Label"
        />
        <span className="min-w-0 flex-1 truncate">{layer.name}</span>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-[#aaa] hover:bg-[#5c2b2b] hover:text-white"
          aria-label={`Remove layer ${layer.name}`}
          title="Remove layer"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete();
          }}
        >
          <Trash2 className="size-3" />
        </button>
      </div>
      {trailing}
    </Fragment>
  );
}
