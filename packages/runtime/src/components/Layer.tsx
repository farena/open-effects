import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Layer as LayerT } from "@open-effects/shared-types";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { scopeCss } from "../lib/scopeCss";
import { computeStylesAtFrame } from "../keyframes/computeStylesAtFrame";

export const Layer: React.FC<{ layer: LayerT }> = ({ layer }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cleanHtml = useMemo(() => sanitizeHtml(layer.html), [layer.html]);
  const scopedCss = useMemo(
    () => scopeCss(layer.css, `[data-layer-id="${layer.id}"]`),
    [layer.css, layer.id]
  );
  const localFrame = frame - layer.startFrame;
  const animatedStyle = useMemo(
    () => computeStylesAtFrame(layer.keyframes, localFrame, fps),
    [layer.keyframes, localFrame, fps]
  );
  return (
    <>
      {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
      <div
        data-layer-id={layer.id}
        style={{ position: "absolute", inset: 0, contain: "strict", ...animatedStyle }}
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    </>
  );
};
