import React from "react";
import { Composition } from "remotion";
import { OpenEffectsComposition } from "./OpenEffectsComposition";
import { singleSceneFixture } from "./fixtures/singleScene";
import { twoScenesFixture } from "./fixtures/twoScenes";
import { unsafeHtmlFixture } from "./fixtures/unsafeHtml";
import { globalCssFixture } from "./fixtures/globalCss";
import { totalDuration } from "./lib/offset";
import type { Project } from "@open-effects/shared-types";

const register = (id: string, project: Project) => (
  <Composition
    id={id}
    component={OpenEffectsComposition}
    durationInFrames={totalDuration(project) || 1}
    fps={project.fps}
    width={project.width}
    height={project.height}
    defaultProps={{ project }}
  />
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Project"
      component={OpenEffectsComposition}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        project: {
          id: "",
          name: "Project",
          width: 1920,
          height: 1080,
          fps: 30 as const,
          scenes: [],
        },
      }}
      calculateMetadata={async ({ props }) => {
        const total = props.project.scenes.reduce(
          (acc: number, s: { durationFrames: number }) =>
            acc + s.durationFrames,
          0,
        );
        return {
          durationInFrames: Math.max(1, total),
          fps: props.project.fps,
          width: props.project.width,
          height: props.project.height,
        };
      }}
    />
    {register("singleScene", singleSceneFixture)}
    {register("twoScenes", twoScenesFixture)}
    {register("unsafeHtml", unsafeHtmlFixture)}
    {register("globalCss", globalCssFixture)}
  </>
);
