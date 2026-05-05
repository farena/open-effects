import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";

describe("Prisma client", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("connects to MariaDB", async () => {
    const result = await db.$queryRawUnsafe<[{ ok: number }]>(
      "SELECT 1 as ok"
    );
    expect(result[0].ok).toBe(1);
  });
});
