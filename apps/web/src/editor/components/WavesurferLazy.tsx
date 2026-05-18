"use client";
import { useEffect, useRef } from "react";

type WS = InstanceType<Awaited<typeof import("wavesurfer.js")>["default"]>;

interface WaveformProps {
  src: string;
  height?: number;
  trimStartFrames?: number;
  trimEndFrames?: number;
  sourceDurationFrames?: number;
}

export function Waveform({
  src,
  height = 32,
  trimStartFrames = 0,
  trimEndFrames,
  sourceDurationFrames,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let ws: WS | null = null;
    let cancelled = false;
    (async () => {
      const { default: WaveSurfer } = await import("wavesurfer.js");
      if (cancelled || !containerRef.current) return;
      ws = WaveSurfer.create({
        container: containerRef.current,
        height,
        normalize: true,
        waveColor: "rgba(255,255,255,0.5)",
        progressColor: "rgba(255,255,255,0.8)",
        interact: false,
        cursorWidth: 0,
        barWidth: 1,
      });
      ws.load(src);
    })();
    return () => {
      cancelled = true;
      ws?.destroy();
    };
  }, [src, height]);

  // When trim metadata is available, render the full source waveform at a
  // wider inner width and translate it left so only frames [trimStart, trimEnd]
  // remain inside the parent strip (which already has overflow-hidden).
  const visibleFrames =
    trimEndFrames !== undefined ? trimEndFrames - trimStartFrames : undefined;
  const canWindow =
    sourceDurationFrames !== undefined &&
    sourceDurationFrames > 0 &&
    visibleFrames !== undefined &&
    visibleFrames > 0;

  const scale = canWindow ? sourceDurationFrames! / visibleFrames! : 1;
  const translatePct = canWindow
    ? -(trimStartFrames / sourceDurationFrames!) * 100
    : 0;

  return (
    <div className="pointer-events-none w-full overflow-hidden">
      <div
        ref={containerRef}
        style={{
          width: `${scale * 100}%`,
          transform: `translateX(${translatePct}%)`,
        }}
      />
    </div>
  );
}
