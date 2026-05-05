import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { POST } from "@/app/api/projects/route";
import { GET, PATCH, DELETE } from "@/app/api/projects/[id]/route";
import { db } from "@/lib/db";
import { persistProjectJson } from "@/lib/persistence/persistProjectJson";
import { ProjectSchema } from "@open-effects/shared-types";

describe("POST /api/projects", () => {
  beforeEach(async () => {
    await db.project.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns 201 + { id } for a valid body and seeds one default scene with one layer", async () => {
    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: "My Project", width: 1920, height: 1080, fps: 30 }),
      headers: { "Content-Type": "application/json" }
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);

    // Verify project exists in DB
    const project = await db.project.findUnique({ where: { id: body.id } });
    expect(project).not.toBeNull();
    expect(project!.name).toBe("My Project");
    expect(project!.width).toBe(1920);
    expect(project!.height).toBe(1080);
    expect(project!.fps).toBe(30);

    // Verify one scene with one layer was seeded
    const scenes = await db.scene.findMany({ where: { projectId: body.id } });
    expect(scenes).toHaveLength(1);

    const layers = await db.layer.findMany({ where: { sceneId: scenes[0].id } });
    expect(layers).toHaveLength(1);
  });

  it("returns 400 when name is missing", async () => {
    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ width: 1920, height: 1080, fps: 30 }),
      headers: { "Content-Type": "application/json" }
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when fps is not a valid value (50 is not allowed)", async () => {
    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Bad FPS", width: 1920, height: 1080, fps: 50 }),
      headers: { "Content-Type": "application/json" }
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// Helper: seed a project via POST and return its id
async function seedProject(name = "Test Project") {
  const req = new Request("http://localhost/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, width: 1920, height: 1080, fps: 30 }),
    headers: { "Content-Type": "application/json" }
  });
  const res = await POST(req);
  const body = await res.json();
  return body.id as string;
}

describe("GET /api/projects/:id", () => {
  beforeEach(async () => {
    await db.project.deleteMany();
  });

  it("returns 200 + valid Project JSON for an existing project", async () => {
    const id = await seedProject("GET Test");
    const res = await GET(new Request(`http://localhost/api/projects/${id}`), {
      params: Promise.resolve({ id })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = ProjectSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.id).toBe(id);
    expect(parsed.data?.name).toBe("GET Test");
  });

  it("returns 404 for a non-existent id", async () => {
    const res = await GET(new Request("http://localhost/api/projects/nonexistent-id"), {
      params: Promise.resolve({ id: "nonexistent-id" })
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

describe("PATCH /api/projects/:id", () => {
  beforeEach(async () => {
    await db.project.deleteMany();
  });

  it("returns 200 and persists changes when given a valid Project body", async () => {
    const id = await seedProject("PATCH Test");

    // Fetch existing project to use as base
    const getRes = await GET(new Request(`http://localhost/api/projects/${id}`), {
      params: Promise.resolve({ id })
    });
    const existing = await getRes.json();

    // Modify the name
    const updated = { ...existing, name: "PATCH Test Updated" };

    const req = new Request(`http://localhost/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updated),
      headers: { "Content-Type": "application/json" }
    });
    const res = await PATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("ok", true);

    // Verify change persisted via GET
    const verifyRes = await GET(new Request(`http://localhost/api/projects/${id}`), {
      params: Promise.resolve({ id })
    });
    const verified = await verifyRes.json();
    expect(verified.name).toBe("PATCH Test Updated");
  });

  it("returns 400 when body has invalid fps", async () => {
    const id = await seedProject("PATCH Bad FPS");

    const req = new Request(`http://localhost/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ id, name: "X", width: 1920, height: 1080, fps: 50, scenes: [] }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await PATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when patching a non-existent project", async () => {
    const id = "missing-project-id";
    const req = new Request(`http://localhost/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ id, name: "Ghost", width: 1920, height: 1080, fps: 30, scenes: [] }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await PATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

describe("DELETE /api/projects/:id", () => {
  beforeEach(async () => {
    await db.project.deleteMany();
  });

  it("returns 200 and removes project so subsequent GET returns 404", async () => {
    const id = await seedProject("DELETE Test");

    const req = new Request(`http://localhost/api/projects/${id}`, {
      method: "DELETE"
    });
    const res = await DELETE(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("ok", true);

    // Subsequent GET should 404
    const getRes = await GET(new Request(`http://localhost/api/projects/${id}`), {
      params: Promise.resolve({ id })
    });
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting a non-existent project", async () => {
    const id = "missing-project-id";
    const res = await DELETE(new Request(`http://localhost/api/projects/${id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id })
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
