"use client";

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
import type { Scene } from "@open-effects/shared-types";
import { useEditorStore } from "@/editor/store";

interface SortableSceneItemProps {
  scene: Scene;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableSceneItem({
  scene,
  index,
  isSelected,
  onSelect,
  onDelete,
}: SortableSceneItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id });

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
        <span className="truncate">Scene {index + 1}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {scene.durationFrames}f
        </span>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="invisible group-hover:visible ml-1 shrink-0 rounded px-1 text-muted-foreground hover:text-destructive"
        aria-label="Delete scene"
      >
        ×
      </button>
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

  function handleDelete(sceneId: string) {
    if (window.confirm("Delete this scene?")) {
      deleteScene(sceneId);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Scenes
        </span>
        <button
          onClick={addScene}
          className="rounded px-1.5 py-0.5 text-sm hover:bg-muted"
          aria-label="Add scene"
        >
          +
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1">
        {sorted.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No scenes yet.</p>
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
                  onDelete={() => handleDelete(scene.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
