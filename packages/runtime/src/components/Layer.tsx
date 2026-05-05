import React, { useMemo } from "react";
import type { Layer as LayerT } from "@open-effects/shared-types";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { scopeCss } from "../lib/scopeCss";

export const Layer: React.FC<{ layer: LayerT }> = ({ layer }) => {
  const cleanHtml = useMemo(() => sanitizeHtml(layer.html), [layer.html]);
  const scopedCss = useMemo(
    () => scopeCss(layer.css, `[data-layer-id="${layer.id}"]`),
    [layer.css, layer.id]
  );
  return (
    <>
      {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
      <div
        data-layer-id={layer.id}
        style={{ position: "absolute", inset: 0, contain: "strict" }}
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    </>
  );
};
