import { describe, it, expect, vi, beforeEach } from "vitest";
import { transcriptRegistry } from "@/lib/transcript/transcriptRegistry";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transcriptRegistry", () => {
  it("create returns a job with status 'queued'", () => {
    const job = transcriptRegistry.create({
      projectId: "proj-create",
      trackId: "track-create",
    });

    expect(job.id).toBeTruthy();
    expect(job.projectId).toBe("proj-create");
    expect(job.trackId).toBe("track-create");
    expect(job.status).toBe("queued");
    expect(job.progress).toBe(0);
    expect(job.startedAt).toBeGreaterThan(0);
    expect(job.transcript).toBeUndefined();
    expect(job.finishedAt).toBeUndefined();

    const fetched = transcriptRegistry.get(job.id);
    expect(fetched).toEqual(job);
  });

  it("update mutates and notifies subscribers", () => {
    const job = transcriptRegistry.create({
      projectId: "proj-update",
      trackId: "track-update",
    });
    const listener = vi.fn();

    transcriptRegistry.subscribe(job.id, listener);
    transcriptRegistry.update(job.id, { status: "transcribing", progress: 0.5 });

    const updated = transcriptRegistry.get(job.id);
    expect(updated?.status).toBe("transcribing");
    expect(updated?.progress).toBe(0.5);
    expect(updated?.projectId).toBe("proj-update");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ status: "transcribing", progress: 0.5 }),
    );
  });

  it("subscribe returns an unsub function that stops notifications", () => {
    const job = transcriptRegistry.create({
      projectId: "proj-unsub",
      trackId: "track-unsub",
    });
    const listener = vi.fn();

    const unsub = transcriptRegistry.subscribe(job.id, listener);
    transcriptRegistry.update(job.id, { status: "model-loading" });
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    transcriptRegistry.update(job.id, { status: "completed", progress: 1 });
    // listener should NOT be called again after unsubscribing
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("subscribing to a non-existent id returns a no-op unsub", () => {
    const listener = vi.fn();
    const unsub = transcriptRegistry.subscribe("nonexistent-id", listener);

    // Should not throw when called
    expect(() => unsub()).not.toThrow();
    // Listener should never have been called
    expect(listener).not.toHaveBeenCalled();
  });
});
