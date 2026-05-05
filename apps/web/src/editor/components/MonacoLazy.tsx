"use client";

import dynamic from "next/dynamic";
import type { EditorProps } from "@monaco-editor/react";

const Editor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 text-sm text-muted-foreground">Loading editor…</div>
    ),
  },
);

export function MonacoLazy({ theme = "vs-dark", ...props }: EditorProps) {
  return <Editor theme={theme} {...props} />;
}
