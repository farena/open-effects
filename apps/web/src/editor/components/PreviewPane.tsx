"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, type ComponentType } from "react";
import type { PlayerRef } from "@remotion/player";
import { useEditorStore } from "@/editor/store";
import { selectTotalDuration } from "@/editor/selectors";
import { OpenEffectsComposition } from "@open-effects/runtime";

const Player = dynamic(
  () => import("@remotion/player").then((m) => m.Player),
  { ssr: false },
);

// Cast required because Remotion's LooseComponentType expects Record<string, unknown>
// while OpenEffectsComposition is typed with its specific props.
const RemotionComp =
  OpenEffectsComposition as ComponentType<Record<string, unknown>>;

export function PreviewPane() {
  const project = useEditorStore((s) => s.project);
  const totalFrames = useEditorStore(selectTotalDuration);
  const setCurrentFrame = useEditorStore((s) => s.setCurrentFrame);
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const handler = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame);
    };
    player.addEventListener("frameupdate", handler);
    return () => {
      player.removeEventListener("frameupdate", handler);
    };
  }, [setCurrentFrame, project.id]);

  if (!project.id) return null;
  return (
    <div className="flex h-full w-full items-center justify-center bg-black/90 p-4">
      <div className="aspect-video w-full max-w-3xl">
        <Player
          ref={playerRef}
          component={RemotionComp}
          inputProps={{ project }}
          durationInFrames={Math.max(totalFrames, 1)}
          compositionWidth={project.width}
          compositionHeight={project.height}
          fps={project.fps}
          controls
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
