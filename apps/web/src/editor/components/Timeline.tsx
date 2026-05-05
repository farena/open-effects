"use client";

import { useEditorStore } from "@/editor/store";
import { selectTotalDuration } from "@/editor/selectors";

export function Timeline() {
  const scenes = useEditorStore((s) => s.project.scenes);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const total = useEditorStore(selectTotalDuration);

  const sorted = [...scenes].sort((a, b) => a.order - b.order);

  return (
    <div className="flex h-full flex-col bg-muted/20 p-2">
      <div className="text-xs text-muted-foreground mb-1">
        Timeline · {total} frames
      </div>

      <div className="relative flex h-12 w-full overflow-hidden rounded border bg-background">
        {sorted.map((scene, index) => {
          const widthPct =
            total > 0 ? (scene.durationFrames / total) * 100 : 0;
          const isSelected = selectedSceneId === scene.id;

          return (
            <button
              key={scene.id}
              onClick={() => selectScene(scene.id)}
              className={[
                "flex flex-col items-start justify-center px-2 h-full border-r last:border-r-0 overflow-hidden text-left transition-colors",
                isSelected
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted text-foreground",
              ].join(" ")}
              style={{ width: `${widthPct}%` }}
              aria-label={`Select Scene ${index + 1}`}
            >
              <span className="text-xs font-medium truncate leading-none">
                Scene {index + 1}
              </span>
              <span className="text-xs text-muted-foreground leading-none mt-0.5">
                {scene.durationFrames}f
              </span>
            </button>
          );
        })}

        {/* Playhead cursor */}
        {total > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none"
            style={{ left: `${(currentFrame / total) * 100}%` }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
