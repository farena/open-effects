import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { POST as POST_PROJECTS } from "@/app/api/projects/route";
import { PATCH as PATCH_PROJECT } from "@/app/api/projects/[id]/route";
import { POST as POST_DUPLICATE } from "@/app/api/projects/[id]/duplicate/route";
import { db } from "@/lib/db";
import { toProjectJson } from "@/lib/persistence/toProjectJson";

async function seedProject(name = "Dup Source") {
  const req = new Request("http://localhost/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, width: 1920, height: 1080, fps: 30 }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST_PROJECTS(req);
  const body = await res.json();
  return body.id as string;
}

describe("POST /api/projects/:id/duplicate", () => {
  beforeEach(async () => {
    await db.project.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns 201 + a new id, leaves the source untouched, and appends '(duplicated)' to the name", async () => {
    const sourceId = await seedProject("Promo Video");

    const res = await POST_DUPLICATE(
      new Request(`http://localhost/api/projects/${sourceId}/duplicate`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: sourceId }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.id).not.toBe(sourceId);

    const source = await db.project.findUniqueOrThrow({ where: { id: sourceId } });
    const dup = await db.project.findUniqueOrThrow({ where: { id: body.id } });
    expect(source.name).toBe("Promo Video");
    expect(dup.name).toBe("Promo Video (duplicated)");
    expect(dup.width).toBe(source.width);
    expect(dup.height).toBe(source.height);
    expect(dup.fps).toBe(source.fps);
  });

  it("clones scenes/layers/keyframes with fresh IDs and preserves css + videoScript", async () => {
    const sourceId = await seedProject("Original");

    // Enrich source: set css, videoScript, and a layer keyframe.
    const original = await toProjectJson(sourceId);
    const enriched = {
      ...original,
      css: "/* font import */",
      scenes: original.scenes.map((s, i) =>
        i === 0
          ? {
              ...s,
              layers: s.layers.map((l) => ({
                ...l,
                keyframes: [
                  {
                    id: "kf_seed_1",
                    frame: 0,
                    property: "OPACITY",
                    value: "0",
                    easingOut: { type: "linear" as const },
                  },
                  {
                    id: "kf_seed_2",
                    frame: 30,
                    property: "OPACITY",
                    value: "1",
                    easingOut: { type: "linear" as const },
                  },
                ],
              })),
            }
          : s,
      ),
    };
    const patchRes = await PATCH_PROJECT(
      new Request(`http://localhost/api/projects/${sourceId}`, {
        method: "PATCH",
        body: JSON.stringify(enriched),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: sourceId }) },
    );
    expect(patchRes.status).toBe(200);
    await db.project.update({
      where: { id: sourceId },
      data: { videoScript: [{ id: "vsl_1", timestamp: "00:00", text: "hello" }] },
    });

    const dupRes = await POST_DUPLICATE(
      new Request(`http://localhost/api/projects/${sourceId}/duplicate`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: sourceId }) },
    );
    expect(dupRes.status).toBe(201);
    const { id: dupId } = await dupRes.json();

    const sourceJson = await toProjectJson(sourceId);
    const dupJson = await toProjectJson(dupId);

    expect(dupJson.css).toBe("/* font import */");
    expect(dupJson.scenes).toHaveLength(sourceJson.scenes.length);
    expect(dupJson.scenes[0].layers).toHaveLength(sourceJson.scenes[0].layers.length);
    expect(dupJson.scenes[0].layers[0].keyframes).toHaveLength(2);

    // IDs must be fresh.
    const sourceSceneIds = sourceJson.scenes.map((s) => s.id);
    const dupSceneIds = dupJson.scenes.map((s) => s.id);
    for (const sid of dupSceneIds) {
      expect(sourceSceneIds).not.toContain(sid);
    }
    const sourceKfIds = sourceJson.scenes[0].layers[0].keyframes.map((k) => k.id);
    const dupKfIds = dupJson.scenes[0].layers[0].keyframes.map((k) => k.id);
    for (const kid of dupKfIds) {
      expect(sourceKfIds).not.toContain(kid);
    }

    const dupRow = await db.project.findUniqueOrThrow({
      where: { id: dupId },
      select: { videoScript: true },
    });
    expect(dupRow.videoScript).toEqual([
      { id: "vsl_1", timestamp: "00:00", text: "hello" },
    ]);
  });

  it("returns 404 when the source project does not exist", async () => {
    const res = await POST_DUPLICATE(
      new Request("http://localhost/api/projects/missing/duplicate", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
