import type { Project } from "@open-effects/shared-types";

export function sceneStartFrame(project: Project, sceneIndex: number): number {
  return project.scenes.slice(0, sceneIndex).reduce((acc, s) => acc + s.durationFrames, 0);
}

export function totalDuration(project: Project): number {
  return project.scenes.reduce((acc, s) => acc + s.durationFrames, 0);
}
