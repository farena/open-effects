import { newId } from "@/lib/ids";
import type { TranscriptJob } from "./types";

type Listener = (job: TranscriptJob) => void;

type RegistryStore = {
  jobs: Map<string, TranscriptJob>;
  subs: Map<string, Set<Listener>>;
};

const globalForRegistry = globalThis as unknown as {
  __openEffectsTranscriptRegistry__?: RegistryStore;
};

const store: RegistryStore =
  globalForRegistry.__openEffectsTranscriptRegistry__ ?? {
    jobs: new Map(),
    subs: new Map(),
  };
globalForRegistry.__openEffectsTranscriptRegistry__ = store;

const { jobs, subs } = store;

export const transcriptRegistry = {
  create({
    projectId,
    trackId,
  }: {
    projectId: string;
    trackId: string;
  }): TranscriptJob {
    const job: TranscriptJob = {
      id: newId(),
      projectId,
      trackId,
      status: "queued",
      progress: 0,
      startedAt: Date.now(),
    };
    jobs.set(job.id, job);
    subs.set(job.id, new Set());
    return job;
  },
  get(id: string) {
    return jobs.get(id);
  },
  update(id: string, patch: Partial<TranscriptJob>) {
    const cur = jobs.get(id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    jobs.set(id, next);
    subs.get(id)?.forEach((l) => l(next));
  },
  subscribe(id: string, listener: Listener) {
    const set = subs.get(id);
    if (!set) return () => {};
    set.add(listener);
    return () => set.delete(listener);
  },
};
