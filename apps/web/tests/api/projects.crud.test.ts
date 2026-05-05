import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { POST } from "@/app/api/projects/route";
import { db } from "@/lib/db";

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
