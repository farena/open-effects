import { describe, it, expect, afterAll } from "vitest";
import { GET } from "@/app/api/health/route";
import { db } from "@/lib/db";

describe("GET /api/health", () => {
  afterAll(async () => { await db.$disconnect(); });
  it("returns ok when DB is reachable", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", db: "up" });
  });
});
