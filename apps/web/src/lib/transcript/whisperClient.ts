import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { TranscriptSchema } from "@open-effects/shared-types";
import type { Transcript } from "@open-effects/shared-types";
import { transcriptCacheKey } from "./cacheKey";
import { mapWhisperResponse } from "./mapWhisperResponse";
import type { TranscriptJob } from "./types";

export async function transcribeAudio(opts: {
  filePath: string;
  assetSha: string;
  model: string;
  language: string;
  fps: number;
  onStatus?: (s: TranscriptJob["status"]) => void;
}): Promise<Transcript> {
  const { filePath, assetSha, model, language, fps, onStatus } = opts;

  const key = transcriptCacheKey(assetSha, model, language);
  const cachePath = path.join(
    process.cwd(),
    ".cache",
    "transcripts",
    `${key}.json`,
  );

  // Cache hit short-circuit
  try {
    const raw = await readFile(cachePath, "utf8");
    const parsed = TranscriptSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Cache miss — continue below
  }

  // Cache miss: call Whisper
  onStatus?.("model-loading");

  const buf = await readFile(filePath);
  const blob = new Blob([buf]);
  const form = new FormData();
  form.append("audio_file", blob);

  const whisperUrl = process.env.WHISPER_URL ?? "http://localhost:9000";
  const langParam =
    language && language !== "auto" ? `&language=${language}` : "";
  const url = `${whisperUrl}/asr?task=transcribe&output=json&word_timestamps=true${langParam}`;

  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(
      `Whisper request failed: ${res.status} ${res.statusText}`,
    );
  }

  onStatus?.("transcribing");

  const rawJson = await res.json();
  const transcript = mapWhisperResponse(rawJson, fps, model);

  // Validate before caching (defense in depth)
  TranscriptSchema.parse(transcript);

  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(transcript));

  return transcript;
}
