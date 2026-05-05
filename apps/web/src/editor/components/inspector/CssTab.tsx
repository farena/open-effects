"use client";

import { MonacoLazy } from "../MonacoLazy";
import { useEditorStore } from "@/editor/store";
import { selectActiveLayer } from "@/editor/selectors";

export function CssTab() {
  const layer = useEditorStore(selectActiveLayer);
  const update = useEditorStore((s) => s.updateLayerCss);

  if (!layer) return null;

  return (
    <div className="flex-1 min-h-0">
      <MonacoLazy
        height="100%"
        defaultLanguage="css"
        value={layer.css}
        onChange={(v) => update(layer.id, v ?? "")}
        options={{ minimap: { enabled: false }, wordWrap: "on", fontSize: 13 }}
      />
    </div>
  );
}
