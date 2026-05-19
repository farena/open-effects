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
  // Subtitle layers split their CSS in two: subtitle.presetCss is the auto-
  // generated, regenerable per-preset stylesheet (@keyframes, animation-delay
  // bound to --re-time); layer.css holds the user's own overrides. Concatenate
  // preset first so user rules win by cascade order.
  const subtitlePresetCss =
    layer.type === "subtitle" ? layer.subtitle.presetCss : "";
  const rawCss = useMemo(() => {
    if (!subtitlePresetCss) return layer.css;
    return layer.css ? `${subtitlePresetCss}\n${layer.css}` : subtitlePresetCss;
  }, [subtitlePresetCss, layer.css]);
  const scopedCss = useMemo(
    () => scopeCss(rawCss, `[data-layer-id="${layer.id}"]`),
    [rawCss, layer.id],
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

  // Expose the layer-local time as a CSS custom property so subtitle presets
  // (and any future time-driven CSS) can drive `animation-delay` from the
  // Remotion frame instead of the browser's wall clock — combined with
  // `animation-play-state: paused`, this keeps CSS animations in lockstep with
  // play/pause/seek.
  const reTime = `${localFrame / fps}s`;

  return (
    <>
      {renderedCss && <style dangerouslySetInnerHTML={{ __html: renderedCss }} />}
      <div
        data-layer-id={layer.id}
        style={{
          position: "absolute",
          inset: 0,
          contain: "strict",
          ["--re-time" as never]: reTime,
          ...animatedStyle,
        }}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </>
  );
};
