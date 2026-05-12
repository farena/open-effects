"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { X } from "lucide-react";
import type { PlayerRef } from "@remotion/player";
import { useEditorStore } from "@/editor/store";
import { selectTotalDuration } from "@/editor/selectors";
import { playerControl } from "@/editor/playerControl";
import { OpenEffectsComposition } from "@open-effects/runtime";
import { AssetPreview } from "./AssetPreview";

const Player = dynamic(() => import("@remotion/player").then((m) => m.Player), {
  ssr: false,
});

// Cast required because Remotion's LooseComponentType expects Record<string, unknown>
// while OpenEffectsComposition is typed with its specific props.
const RemotionComp = OpenEffectsComposition as ComponentType<
  Record<string, unknown>
>;

export function PreviewPane() {
  const project = useEditorStore((s) => s.project);
  const totalFrames = useEditorStore(selectTotalDuration);
  const setCurrentFrame = useEditorStore((s) => s.setCurrentFrame);
  // NOTE: we intentionally do NOT subscribe to `currentFrame` here. During
  // playback the rAF loop updates it ~30 times/s; subscribing would cause
  // PreviewPane (and the Remotion Player inside) to re-render at that rate,
  // making the video look choppy. External seeks are wired via store.subscribe
  // below instead, so PreviewPane only re-renders on real prop changes.
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const loopStart = useEditorStore((s) => s.loopStart);
  const loopEnd = useEditorStore((s) => s.loopEnd);
  const volume = useEditorStore((s) => s.volume);
  const previewedAsset = useEditorStore((s) => s.previewedAsset);
  const setPreviewedAsset = useEditorStore((s) => s.setPreviewedAsset);

  // Player is loaded via next/dynamic (ssr:false), so its ref is only set
  // after the import resolves. A plain useRef holds the instance; a boolean
  // state flips on mount/unmount to re-trigger the effects below without
  // ever passing the (possibly unstable) ref into setState directly.
  const playerRef = useRef<PlayerRef | null>(null);
  const [playerMounted, setPlayerMounted] = useState(false);
  const setPlayerRef = useCallback((instance: PlayerRef | null) => {
    playerRef.current = instance;
    playerControl.bind(instance);
    setPlayerMounted((prev) => {
      const next = instance !== null;
      return prev === next ? prev : next;
    });
  }, []);

  const hasContent = project.scenes.length > 0 && totalFrames > 0;

  // Drive play/pause from the store and animate the playhead by polling
  // getCurrentFrame() via requestAnimationFrame while playing. Looping is
  // always on — when the frame reaches the effective end of the active
  // range, we seek back to the start of that range.
  useEffect(() => {
    if (!hasContent || !playerMounted) return;
    const player = playerRef.current;
    if (!player) return;

    if (!isPlaying) {
      player.pause();
      return;
    }

    const lastFrameIdx = Math.max(0, totalFrames - 1);
    const effStart = Math.max(
      0,
      Math.min(loopStart ?? 0, lastFrameIdx),
    );
    const effEndExclusive = Math.max(
      effStart + 1,
      Math.min((loopEnd ?? lastFrameIdx) + 1, totalFrames),
    );

    // Snap into the active range before starting playback.
    const at = player.getCurrentFrame();
    if (at < effStart || at >= effEndExclusive) {
      player.seekTo(effStart);
    }
    player.play();

    let rafId = 0;
    let lastFrame = -1;
    const tick = () => {
      const p = playerRef.current;
      if (p) {
        let f = p.getCurrentFrame();
        if (f >= effEndExclusive - 1 || f >= lastFrameIdx) {
          p.seekTo(effStart);
          f = effStart;
        }
        if (f !== lastFrame) {
          lastFrame = f;
          setCurrentFrame(f);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    isPlaying,
    hasContent,
    playerMounted,
    setCurrentFrame,
    totalFrames,
    loopStart,
    loopEnd,
  ]);

  // Propagate store → Player when currentFrame is changed from a non-playback
  // source (Timeline click, Inspector input). We use store.subscribe (instead
  // of a reactive effect dep on currentFrame) so that the high-frequency
  // updates fired by the rAF loop during playback don't re-render PreviewPane.
  useEffect(() => {
    if (!hasContent || !playerMounted) return;
    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (state.isPlaying) return;
      if (state.currentFrame === prev.currentFrame) return;
      const player = playerRef.current;
      if (!player) return;
      if (player.getCurrentFrame() === state.currentFrame) return;
      player.seekTo(state.currentFrame);
    });
    return unsubscribe;
  }, [hasContent, playerMounted]);

  // Push volume changes into the Player.
  useEffect(() => {
    if (!playerMounted) return;
    const player = playerRef.current;
    if (!player) return;
    player.setVolume(volume);
  }, [volume, playerMounted]);

  if (!project.id) return null;

  if (previewedAsset) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-black/90 p-4">
        <button
          type="button"
          aria-label="Close asset preview"
          title="Close preview"
          onClick={() => setPreviewedAsset(null)}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/90 ring-1 ring-white/20 transition hover:bg-black/80 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <AssetPreview asset={previewedAsset} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black/90 p-4">
      <div className="aspect-video w-full" style={{ maxHeight: "100%" }}>
        {hasContent ? (
          <Player
            ref={setPlayerRef}
            component={RemotionComp}
            inputProps={{ project }}
            durationInFrames={totalFrames}
            compositionWidth={project.width}
            compositionHeight={project.height}
            fps={project.fps}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
            Add a scene to start previewing.
          </div>
        )}
      </div>
    </div>
  );
}
