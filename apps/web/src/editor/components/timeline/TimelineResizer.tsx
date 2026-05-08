"use client";
import { useCallback, useEffect, useRef } from "react";

export function TimelineResizer({
  height,
  onResize,
  onCommit,
}: {
  height: number;
  onResize: (next: number) => void; // live (clamped)
  onCommit: (final: number) => void; // on pointer up — persists
}) {
  const startY = useRef(0);
  const startH = useRef(0);
  const draggingRef = useRef(false);
  // Mirrors the parent-clamped height so onCommit reads the latest
  // value synchronously, not the React prop which may be one render behind.
  const latestHRef = useRef(height);
  useEffect(() => {
    latestHRef.current = height;
  }, [height]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = true;
      startY.current = e.clientY;
      startH.current = height;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [height],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const dy = startY.current - e.clientY; // up = grow
      onResize(startH.current + dy);
    },
    [onResize],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
      onCommit(latestHRef.current);
    },
    [onCommit],
  );

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize timeline"
      className="h-1 cursor-row-resize border-y border-border/60 bg-muted/50 hover:bg-accent/50 touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
