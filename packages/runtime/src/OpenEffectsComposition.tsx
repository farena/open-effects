import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { Project } from "@open-effects/shared-types";
import { SceneRenderer } from "./components/SceneRenderer";
import { sceneStartFrame } from "./lib/offset";

export const OpenEffectsComposition: React.FC<{ project: Project }> = ({ project }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      {project.scenes.map((scene, i) => (
        <Sequence key={scene.id} from={sceneStartFrame(project, i)} durationInFrames={scene.durationFrames}>
          <SceneRenderer scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
