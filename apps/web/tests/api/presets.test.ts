import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { POST, GET } from "@/app/api/presets/route";
import { GET as GET_BY_ID, PATCH, DELETE } from "@/app/api/presets/[id]/route";
import { db } from "@/lib/db";

function makeCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    key: "custom-flash",
    name: "Custom Flash",
    category: "effect",
    iconKey: "zap",
    defaultDuration: 30,
    defaultEasing: { type: "linear" },
    params: [
      { kind: "number", key: "amp", label: "Amp", default: 1, min: 0, max: 1 },
    ],
    animatedProperties: ["opacity"],
    tracks: [
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "0" },
          { fraction: 1, value: "${amp}" },
        ],
      },
    ],
    ...overrides,
  };
}

async function createPreset(body: unknown) {
  return POST(
    new Request("http://localhost/api/presets", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(async () => {
  // Wipe only non-builtin rows so the seed catalog remains intact.
  await db.animationPreset.deleteMany({ where: { isBuiltIn: false } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("GET /api/presets", () => {
  it("returns the seeded built-in presets (24+)", async () => {
    const res = await GET(new Request("http://localhost/api/presets"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(24);
    const builtIn = body.filter((p: { isBuiltIn: boolean }) => p.isBuiltIn);
    expect(builtIn.length).toBeGreaterThanOrEqual(24);
  });

  it("filters by category", async () => {
    const res = await GET(
      new Request("http://localhost/api/presets?category=in"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.every((p: { category: string }) => p.category === "in")).toBe(
      true,
    );
  });
});

describe("POST /api/presets", () => {
  it("creates a custom preset and returns 201", async () => {
    const res = await createPreset(makeCreateBody());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("key", "custom-flash");
    expect(body).toHaveProperty("isBuiltIn", false);
    expect(body.tracks).toEqual([
      {
        property: "opacity",
        stops: [
          { fraction: 0, value: "0" },
          { fraction: 1, value: "${amp}" },
        ],
      },
    ]);
  });

  it("returns 400 on schema violation (missing tracks)", async () => {
    const res = await createPreset(makeCreateBody({ tracks: undefined }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid key format", async () => {
    const res = await createPreset(makeCreateBody({ key: "Not Kebab" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when key collides", async () => {
    await createPreset(makeCreateBody({ key: "dup-preset" }));
    const dup = await createPreset(makeCreateBody({ key: "dup-preset" }));
    expect(dup.status).toBe(409);
  });

  it("rejects key colliding with a built-in", async () => {
    const res = await createPreset(makeCreateBody({ key: "fade-in" }));
    expect(res.status).toBe(409);
  });
});

describe("GET /api/presets/:id", () => {
  it("returns the preset by id", async () => {
    const created = await createPreset(makeCreateBody({ key: "show-me" }));
    const { id } = await created.json();
    const res = await GET_BY_ID(
      new Request(`http://localhost/api/presets/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("key", "show-me");
  });

  it("returns 404 for unknown id", async () => {
    const res = await GET_BY_ID(
      new Request("http://localhost/api/presets/nonexistent"),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/presets/:id", () => {
  it("updates a custom preset's name", async () => {
    const created = await createPreset(makeCreateBody({ key: "patch-me" }));
    const { id } = await created.json();
    const res = await PATCH(
      new Request(`http://localhost/api/presets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Patched Name" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("name", "Patched Name");
  });

  it("rejects changing the key of a built-in preset", async () => {
    const fadeIn = await db.animationPreset.findUnique({
      where: { key: "fade-in" },
    });
    expect(fadeIn).not.toBeNull();
    const res = await PATCH(
      new Request(`http://localhost/api/presets/${fadeIn!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ key: "fade-in-2" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: fadeIn!.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("allows editing other fields on a built-in preset (name)", async () => {
    const fadeIn = await db.animationPreset.findUnique({
      where: { key: "fade-in" },
    });
    expect(fadeIn).not.toBeNull();
    const originalName = fadeIn!.name;
    const res = await PATCH(
      new Request(`http://localhost/api/presets/${fadeIn!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Fade In (renamed)" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: fadeIn!.id }) },
    );
    expect(res.status).toBe(200);
    // Restore the original name so other tests stay deterministic.
    await db.animationPreset.update({
      where: { id: fadeIn!.id },
      data: { name: originalName },
    });
  });

  it("returns 409 when renaming a custom preset to an existing key", async () => {
    const a = await createPreset(makeCreateBody({ key: "alpha" }));
    const b = await createPreset(makeCreateBody({ key: "beta" }));
    const bJson = await b.json();
    const res = await PATCH(
      new Request(`http://localhost/api/presets/${bJson.id}`, {
        method: "PATCH",
        body: JSON.stringify({ key: "alpha" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: bJson.id }) },
    );
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/presets/:id", () => {
  it("deletes a custom preset", async () => {
    const created = await createPreset(makeCreateBody({ key: "delete-me" }));
    const { id } = await created.json();
    const res = await DELETE(
      new Request(`http://localhost/api/presets/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const row = await db.animationPreset.findUnique({ where: { id } });
    expect(row).toBeNull();
  });

  it("refuses to delete a built-in preset", async () => {
    const fadeIn = await db.animationPreset.findUnique({
      where: { key: "fade-in" },
    });
    const res = await DELETE(
      new Request(`http://localhost/api/presets/${fadeIn!.id}`),
      { params: Promise.resolve({ id: fadeIn!.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown id", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/presets/nonexistent"),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(res.status).toBe(404);
  });
});
