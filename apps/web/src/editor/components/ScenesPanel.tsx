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
import { Film } from "lucide-react";
import type { Scene } from "@open-effects/shared-types";
import { useEditorStore } from "@/editor/store";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";

interface SortableSceneItemProps {
  scene: Scene;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableSceneItem({
  scene,
  isSelected,
  onSelect,
  onDelete,
}: SortableSceneItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });
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
      {/* Drag handle + label (clicking selects) */}
      <div
        className="flex items-center gap-2 flex-1 min-w-0"
        onClick={onSelect}
      >
        {/* Drag grip */}
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0"
          aria-label="Drag to reorder"
        >
          ⠿
        </span>
        <span className="truncate min-w-0">{scene.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {scene.durationFrames}f
        </span>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setConfirmOpen(true);
        }}
        className="invisible group-hover:visible ml-1 shrink-0 rounded px-1 text-muted-foreground hover:text-destructive"
        aria-label="Delete scene"
      >
        ×
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${scene.name}?`}
        description="The scene and all its layers will be removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
      />
    </div>
  );
}

export function ScenesPanel() {
  const scenes = useEditorStore((s) => s.project.scenes);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const addScene = useEditorStore((s) => s.addScene);
  const deleteScene = useEditorStore((s) => s.deleteScene);
  const selectScene = useEditorStore((s) => s.selectScene);
  const reorderScenes = useEditorStore((s) => s.reorderScenes);

  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const ids = sorted.map((sc) => sc.id);

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const reordered = arrayMove(ids, oldIndex, newIndex);
    reorderScenes(reordered);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Scenes
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={addScene}
            className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            aria-label="Add scene"
          >
            Add scene
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1">
        {sorted.length === 0 ? (
          <EmptyState
            icon={Film}
            title="No scenes"
            description="Every project starts with at least one scene."
            action={{ label: "Add scene", onClick: addScene }}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {sorted.map((scene, index) => (
                <SortableSceneItem
                  key={scene.id}
                  scene={scene}
                  index={index}
                  isSelected={selectedSceneId === scene.id}
                  onSelect={() => selectScene(scene.id)}
                  onDelete={() => deleteScene(scene.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
