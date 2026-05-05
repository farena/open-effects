import { describe, it, expect, afterAll } from "vitest";
import { GET } from "@/app/api/projects/route";
import { db } from "@/lib/db";

describe("GET /api/projects", () => {
  afterAll(async () => { await db.$disconnect(); });
  it("returns an empty array when DB is empty", async () => {
    await db.project.deleteMany();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
