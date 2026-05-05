import { describe, it, expect, beforeEach } from "vitest";
import { processUpload } from "@/lib/assets/upload";
import { db } from "@/lib/db";
import { readFile, unlink } from "node:fs/promises";

describe("processUpload", () => {
  beforeEach(async () => {
    await db.audioTrack.deleteMany();
    await db.asset.deleteMany();
  });

  it("hashes, persists, and returns Asset row", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "test.mp3", {
      type: "audio/mpeg",
    });
    const asset = await processUpload(file);
    expect(asset.type).toBe("audio");
    expect(asset.mimeType).toBe("audio/mpeg");
    expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.size).toBe(4);
    expect(asset.path).toMatch(/^\/assets\/[a-f0-9]{64}\.mp3$/);
    // file exists on disk
    const onDisk = await readFile(`./public${asset.path}`);
    expect(onDisk.length).toBe(4);
    await unlink(`./public${asset.path}`);
  });

  it("dedups by SHA256: second upload returns existing Asset", async () => {
    const file1 = new File([new Uint8Array([1, 2, 3])], "a.mp3", {
      type: "audio/mpeg",
    });
    const file2 = new File([new Uint8Array([1, 2, 3])], "b.mp3", {
      type: "audio/mpeg",
    });
    const a1 = await processUpload(file1);
    const a2 = await processUpload(file2);
    expect(a1.id).toBe(a2.id);
    expect(a1.sha256).toBe(a2.sha256);
    // clean up the file written for a1 (a2 deduped, no second file)
    await unlink(`./public${a1.path}`);
  });

  it("rejects unknown mime types", async () => {
    const file = new File([new Uint8Array([1])], "x.exe", {
      type: "application/x-msdownload",
    });
    await expect(processUpload(file)).rejects.toThrow(/mime/i);
  });

  it("rejects files over MAX_UPLOAD_BYTES", async () => {
    const big = new File([new Uint8Array(201 * 1024 * 1024)], "x.mp3", {
      type: "audio/mpeg",
    });
    await expect(processUpload(big)).rejects.toThrow(/size|too large/i);
  });
});
