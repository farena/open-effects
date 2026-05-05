"use client";

import { ScenesPanel } from "./ScenesPanel";

export function Sidebar() {
  return (
    <div className="flex h-full flex-col bg-muted/40">
      <ScenesPanel />
    </div>
  );
}
