import type { Eq } from "@open-effects/shared-types";

export const EQ_BANDS = [
  { name: "low", freq: 80 },
  { name: "mid", freq: 1000 },
  { name: "high", freq: 5000 },
  { name: "presence", freq: 10000 },
] as const;

export function buildEqFilter(eq: Eq): string {
  return EQ_BANDS.map(
    (b) => `equalizer=f=${b.freq}:t=q:w=1:g=${eq[b.name as keyof Eq]}`,
  ).join(",");
}

export function ffmpegEqArgs(
  inputPath: string,
  outputPath: string,
  eq: Eq,
): string[] {
  return ["-y", "-i", inputPath, "-af", buildEqFilter(eq), outputPath];
}
