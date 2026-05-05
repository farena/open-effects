import React from "react";
import { AbsoluteFill } from "remotion";
import type { Scene } from "@open-effects/shared-types";
import { Layer } from "./Layer";

export const SceneRenderer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const layers = [...scene.layers].sort((a, b) => a.order - b.order);
  return (
    <AbsoluteFill>
      {layers.map((layer) => (
        <Layer key={layer.id} layer={layer} />
      ))}
    </AbsoluteFill>
  );
};
