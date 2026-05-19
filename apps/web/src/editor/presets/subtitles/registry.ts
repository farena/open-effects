import type { SubtitlePreset } from "./types";
import { fade } from "./fade";
import { popUp } from "./pop-up";
import { slide } from "./slide";

/**
 * All built-in subtitle presets. Order determines display order in the UI.
 * All presets are segment-level — for finer granularity (e.g. word-by-word
 * pops), the user should split the transcript into smaller segments.
 */
export const SUBTITLE_PRESETS: SubtitlePreset[] = [fade, slide, popUp];

/**
 * Look up a subtitle preset by its key.
 * Throws a descriptive error if the key is not registered.
 */
export function getSubtitlePreset(key: string): SubtitlePreset {
  const preset = SUBTITLE_PRESETS.find((p) => p.key === key);
  if (!preset) {
    throw new Error(
      `Unknown subtitle preset key: "${key}". ` +
        `Available presets: ${SUBTITLE_PRESETS.map((p) => p.key).join(", ")}`,
    );
  }
  return preset;
}
