import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "@open-effects/shared-types";
import { Layer } from "./Layer";
import { computeStylesAtFrame } from "../keyframes/computeStylesAtFrame";

// Audio tracks belong to a scene in the data model but are rendered at the
// project root (see OpenEffectsComposition), so they keep playing past the
// scene boundary when trimEnd extends beyond scene.durationFrames.
export const SceneRenderer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layers = [...scene.layers].sort((a, b) => a.order - b.order);

  const animatedStyle = useMemo(
    () => computeStylesAtFrame(scene.keyframes, frame, fps),
    [scene.keyframes, frame, fps],
  );

  return (
    <AbsoluteFill
      style={{
        background: scene.background,
        ...animatedStyle,
      }}
    >
      {layers.map((layer) => (
        <Layer key={layer.id} layer={layer} />
      ))}
    </AbsoluteFill>
  );
};
