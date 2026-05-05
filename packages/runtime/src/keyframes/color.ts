import { mixColor as popmotionMixColor } from "popmotion";

export function mixColor(from: string, to: string, t: number): string {
  return popmotionMixColor(from, to)(t);
}
