import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { POST, GET } from "@/app/api/assets/route";
import { DELETE } from "@/app/api/assets/[id]/route";
import { db } from "@/lib/db";
import { POST as POST_PROJECT } from "@/app/api/projects/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal audio File suitable for processUpload. */
function makeAudioFile(name = "test.mp3") {
  // A tiny valid-looking buffer is fine — classify() only checks mime type.
  const buf = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
  return new File([buf], name, { type: "audio/mpeg" });
}

/** POST to /api/assets with a file and return the response. */
async function uploadAsset(file: File) {
  const form = new FormData();
  form.append("file", file);
  return POST(
    new Request("http://localhost/api/assets", { method: "POST", body: form }),
  );
}

/** POST to /api/projects to create a project and return its id. */
async function seedProject(name = "Asset Test Project") {
  const req = new Request("http://localhost/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, width: 1920, height: 1080, fps: 30 }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST_PROJECT(req);
  const body = await res.json();
  return body.id as string;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  // Clean order respects FK: AudioTrack → Asset, Scene → Project
  await db.audioTrack.deleteMany();
  await db.asset.deleteMany();
  await db.project.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

// ---------------------------------------------------------------------------
// POST /api/assets
// ---------------------------------------------------------------------------

describe("POST /api/assets", () => {
  it("returns 201 and an Asset-shaped JSON when a valid audio file is uploaded", async () => {
    const res = await uploadAsset(makeAudioFile("clip.mp3"));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("type", "audio");
    expect(body).toHaveProperty("filename", "clip.mp3");
    expect(body).toHaveProperty("path");
    expect(body).toHaveProperty("mimeType", "audio/mpeg");
    expect(body).toHaveProperty("size");
    expect(body).toHaveProperty("sha256");
  });

  it("returns 400 when no file is provided", async () => {
    const form = new FormData();
    const res = await POST(
      new Request("http://localhost/api/assets", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// GET /api/assets
// ---------------------------------------------------------------------------

describe("GET /api/assets", () => {
  it("returns an array of all assets", async () => {
    await uploadAsset(makeAudioFile("a.mp3"));
    const res = await GET(new Request("http://localhost/api/assets"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by ?type=audio", async () => {
    await uploadAsset(makeAudioFile("b.mp3"));
    const res = await GET(
      new Request("http://localhost/api/assets?type=audio"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.every((a: { type: string }) => a.type === "audio")).toBe(true);
  });

  it("returns empty array when filtering for a type with no uploads", async () => {
    const res = await GET(
      new Request("http://localhost/api/assets?type=video"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/assets/:id — happy path
// ---------------------------------------------------------------------------

describe("DELETE /api/assets/:id", () => {
  it("returns { ok: true } and removes asset from DB", async () => {
    const uploadRes = await uploadAsset(makeAudioFile("todelete.mp3"));
    const asset = await uploadRes.json();
    const id: string = asset.id;

    const delRes = await DELETE(
      new Request(`http://localhost/api/assets/${id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id }) },
    );
    expect(delRes.status).toBe(200);
    const body = await delRes.json();
    expect(body).toHaveProperty("ok", true);

    // Confirm removed from DB
    const found = await db.asset.findUnique({ where: { id } });
    expect(found).toBeNull();
  });

  it("returns 404 when the asset does not exist", async () => {
    const id = "non-existent-asset-id";
    const res = await DELETE(
      new Request(`http://localhost/api/assets/${id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "not_found");
  });

  it("returns 409 when an AudioTrack references the asset", async () => {
    // Create asset
    const uploadRes = await uploadAsset(makeAudioFile("inuse.mp3"));
    const asset = await uploadRes.json();
    const assetId: string = asset.id;

    // Create project + get its first scene
    const projectId = await seedProject("409 Test Project");
    const scene = await db.scene.findFirst({ where: { projectId } });
    expect(scene).not.toBeNull();

    // Create AudioTrack referencing the asset
    await db.audioTrack.create({
      data: {
        sceneId: scene!.id,
        assetId,
        startFrame: 0,
        trimStart: 0,
        trimEnd: 100,
      },
    });

    const res = await DELETE(
      new Request(`http://localhost/api/assets/${assetId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: assetId }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toHaveProperty("error", "in_use");
    expect(body.refs).toBeGreaterThan(0);
  });
});
