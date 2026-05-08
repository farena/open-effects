import { describe, it, expect } from "vitest";
import { sceneStartFrame, totalDuration } from "@/lib/offset";
import type { Project, Transition } from "@open-effects/shared-types";

function makeProject(
  durations: number[],
  transitions: (Transition | null)[] = [],
): Project {
  return {
    id: "p1",
    name: "p",
    width: 1920,
    height: 1080,
    fps: 30,
    scenes: durations.map((d, i) => ({
      id: `s${i}`,
      order: i,
      durationFrames: d,
      layers: [],
      audioTracks: [],
      transitionIn: transitions[i] ?? null,
    })),
  };
}

describe("totalDuration with transitions", () => {
  it("2 scenes [60, 60] no transitions => 120", () => {
    const project = makeProject([60, 60]);
    expect(totalDuration(project)).toBe(120);
  });

  it("2 scenes [60, 60] with scene 2 fade 15 => 105", () => {
    const project = makeProject(
      [60, 60],
      [null, { type: "fade", durationFrames: 15 }],
    );
    expect(totalDuration(project)).toBe(105);
  });

  it("3 scenes [30, 60, 90] with scene 2 fade 10 and scene 3 slide 20 => 150", () => {
    const project = makeProject(
      [30, 60, 90],
      [
        null,
        { type: "fade", durationFrames: 10 },
        { type: "slide-left", durationFrames: 20 },
      ],
    );
    expect(totalDuration(project)).toBe(150);
  });
});

describe("sceneStartFrame with transitions", () => {
  it("2 scenes [60, 60] with scene 2 fade 15 => sceneStartFrame(_, 1) === 45", () => {
    const project = makeProject(
      [60, 60],
      [null, { type: "fade", durationFrames: 15 }],
    );
    expect(sceneStartFrame(project, 1)).toBe(45);
  });

  it("3 scenes [30, 60, 90] with scene 2 fade 10 and scene 3 slide 20 => sceneStartFrame(_, 2) === 60", () => {
    const project = makeProject(
      [30, 60, 90],
      [
        null,
        { type: "fade", durationFrames: 10 },
        { type: "slide-left", durationFrames: 20 },
      ],
    );
    // durations[0..1] = 90, minus transitions[1..2] = 10+20 = 30, gives 60
    expect(sceneStartFrame(project, 2)).toBe(60);
  });

  it("transitions with type 'none' are not counted as overlaps", () => {
    const project = makeProject(
      [60, 60],
      [null, { type: "none", durationFrames: 15 }],
    );
    expect(totalDuration(project)).toBe(120);
    expect(sceneStartFrame(project, 1)).toBe(60);
  });
});
