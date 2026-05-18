import type { Transcript } from "@open-effects/shared-types";

export type TranscriptJob = {
  id: string;
  projectId: string;
  trackId: string;
  status: "queued" | "model-loading" | "transcribing" | "completed" | "error";
  progress: number; // 0..1; whisper-asr-webservice does not stream granular progress, we update at fixed checkpoints
  transcript?: Transcript; // populated when completed
  error?: string;
  startedAt: number;
  finishedAt?: number;
};
