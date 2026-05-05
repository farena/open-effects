import { describe, it, expect } from "vitest";
import { sceneStartFrame, totalDuration } from "@/lib/offset";
import type { Project } from "@open-effects/shared-types";

const fx = (durations: number[]): Project => ({
  id: "p1", name: "p", width: 1920, height: 1080, fps: 30,
  scenes: durations.map((d, i) => ({
    id: `s${i}`, order: i, durationFrames: d, layers: [], audioTracks: []
  }))
});

describe("sceneStartFrame", () => {
  it("returns 0 for first scene", () => {
    expect(sceneStartFrame(fx([30, 60]), 0)).toBe(0);
  });
  it("returns sum of preceding durations", () => {
    expect(sceneStartFrame(fx([30, 60, 90]), 2)).toBe(90);
  });
});

describe("totalDuration", () => {
  it("sums all scene durations", () => {
    expect(totalDuration(fx([30, 60, 90]))).toBe(180);
  });
  it("returns 0 for empty project", () => {
    expect(totalDuration(fx([]))).toBe(0);
  });
});
