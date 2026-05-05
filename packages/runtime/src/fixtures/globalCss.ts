import type { Project } from "@open-effects/shared-types";

export const globalCssFixture: Project = {
  id: "fx-global",
  name: "globalCss",
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [
    {
      id: "s1",
      order: 0,
      durationFrames: 60,
      layers: [
        {
          id: "L1",
          order: 0,
          name: "GlobalCss",
          html: '<div class="box">CSS scoping test</div>',
          css: "body { background: red } .box { font-size: 96px; color: white; padding: 80px; font-family: sans-serif; background: blue; }",
          startFrame: 0,
          endFrame: 60,
          visible: true,
          keyframes: [],
        },
      ],
      audioTracks: [],
    },
  ],
};
