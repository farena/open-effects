"use client";
import dynamic from "next/dynamic";
export const MonacoLazy = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading editor…</div> }
);
