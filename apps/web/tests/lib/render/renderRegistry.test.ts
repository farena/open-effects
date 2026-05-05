import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderRegistry } from "@/lib/render/renderRegistry";

// Reset internal maps between tests by re-importing a fresh module is not
// straightforward with Vite; instead we rely on unique project IDs per test
// and clear state via the public API only (no-op patch to unknown IDs).

beforeEach(() => {
  vi.clearAllMocks();
});

describe("renderRegistry", () => {
  it("create returns a job with queued status and get returns the same job", () => {
    const job = renderRegistry.create("proj-create");

    expect(job.id).toBeTruthy();
    expect(job.projectId).toBe("proj-create");
    expect(job.status).toBe("queued");
    expect(job.progress).toBe(0);
    expect(job.startedAt).toBeGreaterThan(0);
    expect(job.outputUrl).toBeUndefined();
    expect(job.finishedAt).toBeUndefined();

    const fetched = renderRegistry.get(job.id);
    expect(fetched).toEqual(job);
  });

  it("update merges the patch into the existing job", () => {
    const job = renderRegistry.create("proj-update");

    renderRegistry.update(job.id, { status: "rendering", progress: 0.5 });

    const updated = renderRegistry.get(job.id);
    expect(updated?.status).toBe("rendering");
    expect(updated?.progress).toBe(0.5);
    expect(updated?.projectId).toBe("proj-update");
  });

  it("update emits the new job to subscribers", () => {
    const job = renderRegistry.create("proj-emit");
    const listener = vi.fn();

    renderRegistry.subscribe(job.id, listener);
    renderRegistry.update(job.id, { status: "bundling" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ status: "bundling" }),
    );
  });

  it("unsubscribe stops further notifications", () => {
    const job = renderRegistry.create("proj-unsub");
    const listener = vi.fn();

    const unsub = renderRegistry.subscribe(job.id, listener);
    renderRegistry.update(job.id, { status: "rendering" });
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    renderRegistry.update(job.id, { status: "completed", progress: 1 });
    // listener should NOT be called again after unsubscribing
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("update of an unknown id is a no-op", () => {
    // Should not throw
    expect(() => {
      renderRegistry.update("nonexistent-id", { status: "completed" });
    }).not.toThrow();

    expect(renderRegistry.get("nonexistent-id")).toBeUndefined();
  });

  it("subscribe to an unknown id returns a no-op unsubscribe", () => {
    const listener = vi.fn();
    const unsub = renderRegistry.subscribe("unknown-id", listener);

    // Should not throw when called
    expect(() => unsub()).not.toThrow();
    // Listener should never have been called
    expect(listener).not.toHaveBeenCalled();
  });
});
