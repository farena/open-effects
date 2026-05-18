import type { Transcript } from "@open-effects/shared-types";
import { newId } from "@/lib/ids";

type WhisperWord = {
  start: number;
  end: number;
  word: string;
  probability?: number;
};

type WhisperSegment = {
  id?: string | number;
  start: number;
  end: number;
  text: string;
  words?: WhisperWord[];
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

    const words = (seg.words ?? [])
      .map((w) => {
        const text = w.word.trim();
        return { text, start: w.start, end: w.end };
      })
      .filter((w) => w.text !== "")
      .map((w) => {
        const wordStartFrame = Math.round(w.start * fps);
        const wordRawEndFrame = Math.round(w.end * fps);
        const wordEndFrame = Math.max(wordRawEndFrame, wordStartFrame);
        return { text: w.text, startFrame: wordStartFrame, endFrame: wordEndFrame };
      });

    return { id, text: seg.text, startFrame, endFrame, words };
  });

  return {
    language: raw.language,
    model,
    generatedAt: new Date().toISOString(),
    segments,
  };
}
