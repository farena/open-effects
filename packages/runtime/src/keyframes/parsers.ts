export const parseNumeric = (v: string) => Number(v);
export const parseLengthPx = (v: string) => Number(v.replace(/px$/, ""));
export const parseAngleDeg = (v: string) => Number(v.replace(/deg$/, ""));
export const serializeNumeric = (n: number) => String(n);
export const serializeLengthPx = (n: number) => `${n}px`;
export const serializeAngleDeg = (n: number) => `${n}deg`;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
