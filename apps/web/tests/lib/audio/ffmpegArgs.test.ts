import { describe, it, expect } from "vitest";
import { buildEqFilter, ffmpegEqArgs, EQ_BANDS } from "@/lib/audio/ffmpegArgs";
import type { Eq } from "@open-effects/shared-types";

const eq: Eq = { low: 3, mid: 0, high: -2, presence: 6 };

describe("EQ_BANDS", () => {
  it("has four bands with correct frequencies", () => {
    expect(EQ_BANDS).toHaveLength(4);
    expect(EQ_BANDS[0]).toMatchObject({ name: "low", freq: 80 });
    expect(EQ_BANDS[1]).toMatchObject({ name: "mid", freq: 1000 });
    expect(EQ_BANDS[2]).toMatchObject({ name: "high", freq: 5000 });
    expect(EQ_BANDS[3]).toMatchObject({ name: "presence", freq: 10000 });
  });
});

describe("buildEqFilter", () => {
  it("produces comma-joined equalizer chain in order low → mid → high → presence", () => {
    const result = buildEqFilter(eq);
    const parts = result.split(",");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("equalizer=f=80:t=q:w=1:g=3");
    expect(parts[1]).toBe("equalizer=f=1000:t=q:w=1:g=0");
    expect(parts[2]).toBe("equalizer=f=5000:t=q:w=1:g=-2");
    expect(parts[3]).toBe("equalizer=f=10000:t=q:w=1:g=6");
  });

  it("uses equalizer=f=<freq>:t=q:w=1:g=<gain> syntax for each band", () => {
    const result = buildEqFilter(eq);
    for (const part of result.split(",")) {
      expect(part).toMatch(/^equalizer=f=\d+:t=q:w=1:g=-?\d+$/);
    }
  });
});

describe("ffmpegEqArgs", () => {
  it("returns argv array with -y, -i, inputPath, -af, filterChain, outputPath", () => {
    const result = ffmpegEqArgs("/in.mp3", "/out.mp3", eq);
    const expectedFilter = buildEqFilter(eq);
    expect(result).toEqual([
      "-y",
      "-i",
      "/in.mp3",
      "-af",
      expectedFilter,
      "/out.mp3",
    ]);
  });

  it("includes -y as the first argument (overwrite flag)", () => {
    const result = ffmpegEqArgs("/in.mp3", "/out.mp3", eq);
    expect(result[0]).toBe("-y");
  });
});
