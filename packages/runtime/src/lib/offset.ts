import type { Project } from "@open-effects/shared-types";

function transitionOverlapFrames(scenes: Project["scenes"]): number {
  return scenes.reduce((acc, scene) => {
    const t = scene.transitionIn;
    if (t && t.type !== "none") {
      return acc + t.durationFrames;
    }
    return acc;
  }, 0);
}

export function sceneStartFrame(project: Project, sceneIndex: number): number {
  const durationSum = project.scenes
    .slice(0, sceneIndex)
    .reduce((acc, s) => acc + s.durationFrames, 0);

  // Transitions at indices 1..sceneIndex eat into preceding scene tails
  const overlapSum = transitionOverlapFrames(
    project.scenes.slice(1, sceneIndex + 1),
  );

  return durationSum - overlapSum;
}

export function totalDuration(project: Project): number {
  const durationSum = project.scenes.reduce(
    (acc, s) => acc + s.durationFrames,
    0,
  );

  // Transitions at indices >= 1 eat into preceding scene tails
  const overlapSum = transitionOverlapFrames(project.scenes.slice(1));

  return durationSum - overlapSum;
}
