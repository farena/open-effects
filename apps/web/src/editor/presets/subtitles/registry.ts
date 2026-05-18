import type { SubtitlePreset } from "./types";
import { fadeSegment } from "./fade-segment";
import { karaokeWord } from "./karaoke-word";
import { slideSegment } from "./slide-segment";

/**
 * All built-in subtitle presets.
 * To add a new preset, import it and append to this array — order determines
 * the display order in the UI. Tasks 12 and 13 append their presets here.
 */
export const SUBTITLE_PRESETS: SubtitlePreset[] = [
  fadeSegment,
  karaokeWord,
  slideSegment,
];

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
