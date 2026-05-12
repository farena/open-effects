import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import type { Project } from "@open-effects/shared-types";
import { SceneRenderer } from "./components/SceneRenderer";
import { ProjectCssLoader } from "./components/ProjectCssLoader";
import { sceneStartFrame } from "./lib/offset";
import { mapTransitionToPreset } from "./components/transitions";

function hasAnyTransition(project: Project): boolean {
  return project.scenes.some(
    (s, i) => i > 0 && s.transitionIn && s.transitionIn.type !== "none",
  );
}

export const OpenEffectsComposition: React.FC<{ project: Project }> = ({
  project,
}) => {
  const projectCss = project.css?.trim() ? project.css : null;

  if (!hasAnyTransition(project)) {
    return (
      <AbsoluteFill style={{ backgroundColor: "transparent" }}>
        {projectCss && <ProjectCssLoader css={projectCss} />}
        {project.scenes.map((scene, i) => (
          <Sequence
            key={scene.id}
            from={sceneStartFrame(project, i)}
            durationInFrames={scene.durationFrames}
          >
            <SceneRenderer scene={scene} />
          </Sequence>
        ))}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      {projectCss && <ProjectCssLoader css={projectCss} />}
      <TransitionSeries>
        {project.scenes.map((scene, i) => {
          const preset =
            i > 0 && scene.transitionIn
              ? mapTransitionToPreset(scene.transitionIn)
              : null;
          return (
            <React.Fragment key={scene.id}>
              {preset && (
                <TransitionSeries.Transition
                  presentation={preset.presentation}
                  timing={preset.timing}
                />
              )}
              <TransitionSeries.Sequence
                durationInFrames={scene.durationFrames}
              >
                <SceneRenderer scene={scene} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
