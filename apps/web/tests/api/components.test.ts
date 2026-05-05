import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { POST, GET } from "@/app/api/components/route";
import { DELETE } from "@/app/api/components/[id]/route";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid Layer object matching LayerSchema. */
const validLayer = {
  id: "layer-1",
  order: 0,
  name: "Background",
  html: "<div></div>",
  css: "",
  startFrame: 0,
  endFrame: 30,
  visible: true,
  keyframes: [],
};

/** POST to /api/components with JSON body and return the response. */
async function createComponent(body: unknown) {
  return POST(
    new Request("http://localhost/api/components", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await db.savedComponent.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

// ---------------------------------------------------------------------------
// POST /api/components
// ---------------------------------------------------------------------------

describe("POST /api/components", () => {
  it("returns 201 and the saved component when given valid name + payload", async () => {
    const res = await createComponent({
      name: "My Component",
      payload: { layers: [validLayer] },
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("name", "My Component");
    expect(body).toHaveProperty("payload");
    expect(body).toHaveProperty("createdAt");
  });

  it("returns 201 with optional category field", async () => {
    const res = await createComponent({
      name: "Intro Component",
      category: "intros",
      payload: { layers: [validLayer] },
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty("category", "intros");
  });

  it("returns 400 when payload.layers is empty", async () => {
    const res = await createComponent({
      name: "Empty Layers",
      payload: { layers: [] },
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when name is empty string", async () => {
    const res = await createComponent({
      name: "",
      payload: { layers: [validLayer] },
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when payload is missing", async () => {
    const res = await createComponent({ name: "No Payload" });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// GET /api/components
// ---------------------------------------------------------------------------

describe("GET /api/components", () => {
  it("returns an array sorted by createdAt desc", async () => {
    await createComponent({ name: "First", payload: { layers: [validLayer] } });
    await createComponent({
      name: "Second",
      payload: { layers: [validLayer] },
    });

    const res = await GET(new Request("http://localhost/api/components"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);

    // createdAt desc: "Second" should appear before "First"
    expect(body[0]).toHaveProperty("name", "Second");
    expect(body[1]).toHaveProperty("name", "First");
  });

  it("returns empty array when no components exist", async () => {
    const res = await GET(new Request("http://localhost/api/components"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("filters by ?category=intros", async () => {
    await createComponent({
      name: "Intro 1",
      category: "intros",
      payload: { layers: [validLayer] },
    });
    await createComponent({
      name: "Outro 1",
      category: "outros",
      payload: { layers: [validLayer] },
    });

    const res = await GET(
      new Request("http://localhost/api/components?category=intros"),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0]).toHaveProperty("name", "Intro 1");
    expect(body[0]).toHaveProperty("category", "intros");
  });

  it("returns empty array when filtering for a category with no components", async () => {
    const res = await GET(
      new Request("http://localhost/api/components?category=nonexistent"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/components/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/components/:id", () => {
  it("deletes an existing component and returns {ok:true}", async () => {
    // Create a component via POST
    const createRes = await createComponent({
      name: "To Delete",
      payload: { layers: [validLayer] },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const { id } = created;

    // Delete it
    const deleteRes = await DELETE(
      new Request(`http://localhost/api/components/${id}`),
      {
        params: Promise.resolve({ id }),
      },
    );
    expect(deleteRes.status).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody).toEqual({ ok: true });

    // Verify it's gone
    const record = await db.savedComponent.findUnique({ where: { id } });
    expect(record).toBeNull();
  });

  it("returns 404 when deleting a non-existent id", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/components/nonexistent-id"),
      { params: Promise.resolve({ id: "nonexistent-id" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "not_found");
  });
});
