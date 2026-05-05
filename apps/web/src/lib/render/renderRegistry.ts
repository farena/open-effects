import { newId } from "@/lib/ids";

export type RenderJob = {
  id: string;
  projectId: string;
  status: "queued" | "bundling" | "rendering" | "completed" | "error";
  progress: number; // 0..1
  outputUrl?: string;
  error?: string;
  startedAt: number;
  finishedAt?: number;
};

type Listener = (job: RenderJob) => void;
const jobs = new Map<string, RenderJob>();
const subs = new Map<string, Set<Listener>>();

export const renderRegistry = {
  create(projectId: string): RenderJob {
    const job: RenderJob = {
      id: newId(),
      projectId,
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
  update(id: string, patch: Partial<RenderJob>) {
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
