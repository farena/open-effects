import type { Project } from "@open-effects/shared-types";

export const twoScenesFixture: Project = {
  id: "fx-two", name: "twoScenes",
  width: 1920, height: 1080, fps: 30,
  scenes: [
    {
      id: "s1", order: 0, durationFrames: 60,
      layers: [{
        id: "L1", order: 0, name: "First",
        html: '<div class="t">Scene 1</div>',
        css: '.t { font-size: 96px; color: cyan; padding: 80px; font-family: sans-serif; }',
        startFrame: 0, endFrame: 60, keyframes: []
      }],
      audioTracks: []
    },
    {
      id: "s2", order: 1, durationFrames: 60,
      layers: [{
        id: "L2", order: 0, name: "Second",
        html: '<div class="t">Scene 2</div>',
        css: '.t { font-size: 96px; color: magenta; padding: 80px; font-family: sans-serif; }',
        startFrame: 0, endFrame: 60, keyframes: []
      }],
      audioTracks: []
    }
  ]
};
