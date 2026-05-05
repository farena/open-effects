import type { Project } from "@open-effects/shared-types";

export const singleSceneFixture: Project = {
  id: "fx-single",
  name: "singleScene",
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [
    {
      id: "s1",
      order: 0,
      durationFrames: 90,
      layers: [
        {
          id: "L1",
          order: 0,
          name: "Title",
          html: '<div class="title">singleScene fixture</div>',
          css: ".title { font-size: 96px; color: white; padding: 80px; font-family: sans-serif; }",
          startFrame: 0,
          endFrame: 90,
          visible: true,
          keyframes: [],
        },
      ],
      audioTracks: [],
    },
  ],
};
