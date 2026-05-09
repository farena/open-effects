import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Layer as LayerT } from "@open-effects/shared-types";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { scopeCss } from "../lib/scopeCss";
import { substituteCustomValues } from "../lib/substituteCustomValues";
import { computeStylesAtFrame } from "../keyframes/computeStylesAtFrame";
import { computeCustomValuesAtFrame } from "../keyframes/computeCustomValuesAtFrame";

export const Layer: React.FC<{ layer: LayerT }> = ({ layer }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const visibleOnTimeline =
    layer.visible && frame >= layer.startFrame && frame < layer.endFrame;

  const cleanHtml = useMemo(() => sanitizeHtml(layer.html), [layer.html]);
  const scopedCss = useMemo(
    () => scopeCss(layer.css, `[data-layer-id="${layer.id}"]`),
    [layer.css, layer.id],
  );

  const localFrame = frame - layer.startFrame;
  const animatedStyle = useMemo(() => {
    if (!visibleOnTimeline) {
      return {};
    }
    return computeStylesAtFrame(layer.keyframes, localFrame, fps);
  }, [visibleOnTimeline, layer.keyframes, localFrame, fps]);

  const customValues = useMemo(() => {
    if (!visibleOnTimeline) return {};
    return computeCustomValuesAtFrame(layer.keyframes, localFrame, fps);
  }, [visibleOnTimeline, layer.keyframes, localFrame, fps]);

  const renderedHtml = useMemo(
    () => substituteCustomValues(cleanHtml, customValues),
    [cleanHtml, customValues],
  );
  const renderedCss = useMemo(
    () => (scopedCss ? substituteCustomValues(scopedCss, customValues) : scopedCss),
    [scopedCss, customValues],
  );

  if (!visibleOnTimeline) {
    return null;
  }

  return (
    <>
      {renderedCss && <style dangerouslySetInnerHTML={{ __html: renderedCss }} />}
      <div
        data-layer-id={layer.id}
        style={{
          position: "absolute",
          inset: 0,
          contain: "strict",
          ...animatedStyle,
        }}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </>
  );
};
