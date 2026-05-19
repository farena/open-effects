import type { Transcript } from "@open-effects/shared-types";
import { newId } from "@/lib/ids";

type WhisperSegment = {
  id?: string | number;
  start: number;
  end: number;
  text: string;
  // Whisper raw responses include per-word data, but we no longer persist it.
  // The field is kept loosely typed so we ignore it without throwing.
  words?: unknown;
};

export type WhisperRaw = {
  text?: string;
  language?: string;
  segments: WhisperSegment[];
};

export function mapWhisperResponse(
  raw: WhisperRaw,
  fps: number,
  model: string,
): Transcript {
  const segments = raw.segments.map((seg) => {
    const startFrame = Math.round(seg.start * fps);
    const rawEndFrame = Math.round(seg.end * fps);
    const endFrame = Math.max(rawEndFrame, startFrame);

    const id =
      seg.id !== undefined && seg.id !== null ? String(seg.id) : newId();

    return { id, text: seg.text, startFrame, endFrame };
  });

  return {
    language: raw.language,
    model,
    generatedAt: new Date().toISOString(),
    segments,
  };
}
