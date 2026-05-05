"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Layer } from "@open-effects/shared-types";
import { useEditorStore } from "@/editor/store";
import { selectActiveScene } from "@/editor/selectors";
import { ConfirmDialog } from "./ConfirmDialog";

interface SortableLayerItemProps {
  layer: Layer;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableLayerItem({
  layer,
  isSelected,
  onSelect,
  onDelete,
}: SortableLayerItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: layer.id });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "group flex items-center justify-between rounded px-2 py-1.5 text-sm cursor-pointer select-none",
        isSelected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted text-foreground",
      ].join(" ")}
    >
      {/* Drag handle + label */}
      <div className="flex items-center gap-2 flex-1 min-w-0" onClick={onSelect}>
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0"
          aria-label="Drag to reorder"
        >
          ⠿
        </span>
        <span className="truncate">{layer.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          [{layer.startFrame}–{layer.endFrame}]
        </span>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setConfirmOpen(true);
        }}
        className="invisible group-hover:visible ml-1 shrink-0 rounded px-1 text-muted-foreground hover:text-destructive"
        aria-label="Delete layer"
      >
        ×
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete layer “${layer.name}”?`}
        description="The layer and its keyframes will be removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
      />
    </div>
  );
}

export function LayersPanel() {
  const activeScene = useEditorStore(selectActiveScene);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const addLayer = useEditorStore((s) => s.addLayer);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const reorderLayers = useEditorStore((s) => s.reorderLayers);

  const sensors = useSensors(useSensor(PointerSensor));

  if (!activeScene) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a scene first.
      </div>
    );
  }

  const sorted = [...activeScene.layers].sort((a, b) => a.order - b.order);
  const ids = sorted.map((l) => l.id);

  function handleDragEnd(event: DragEndEvent) {
    if (!activeScene) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const reordered = arrayMove(ids, oldIndex, newIndex);
    reorderLayers(activeScene.id, reordered);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Layers
        </span>
        <button
          onClick={() => addLayer(activeScene.id)}
          className="rounded px-1.5 py-0.5 text-sm hover:bg-muted"
          aria-label="Add layer"
        >
          +
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1">
        {sorted.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No layers yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {sorted.map((layer) => (
                <SortableLayerItem
                  key={layer.id}
                  layer={layer}
                  isSelected={selectedLayerId === layer.id}
                  onSelect={() => selectLayer(layer.id)}
                  onDelete={() => deleteLayer(layer.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
