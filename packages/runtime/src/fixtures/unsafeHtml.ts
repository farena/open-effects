import type { Project } from "@open-effects/shared-types";

export const unsafeHtmlFixture: Project = {
  id: "fx-unsafe",
  name: "unsafeHtml",
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [
    {
      id: "s1",
      order: 0,
      name: "Scene 1",
      background: "#000000",
      durationFrames: 60,
      transitionIn: null,
      keyframes: [],
      layers: [
        {
          id: "L1",
          order: 0,
          name: "Unsafe",
          html: '<div class="t">Safe content</div><script>alert(1)</script><a onclick="evil()">x</a>',
          css: ".t { font-size: 96px; color: orange; padding: 80px; font-family: sans-serif; }",
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
