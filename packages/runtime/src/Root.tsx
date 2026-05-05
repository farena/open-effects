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
    {register("singleScene", singleSceneFixture)}
    {register("twoScenes", twoScenesFixture)}
    {register("unsafeHtml", unsafeHtmlFixture)}
    {register("globalCss", globalCssFixture)}
  </>
);
