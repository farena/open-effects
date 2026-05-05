"use client";
import { useEffect, useRef } from "react";

type WS = InstanceType<Awaited<typeof import("wavesurfer.js")>["default"]>;

export function Waveform({
  src,
  height = 32,
}: {
  src: string;
  height?: number;
}) {
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
  return <div ref={containerRef} className="pointer-events-none w-full" />;
}
