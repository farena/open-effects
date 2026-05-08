import { describe, it, expect } from "vitest";
import { ProjectSchema } from "@open-effects/shared-types";
import fixture from "../../../../docs/api/examples/minimal-project.json";

describe("docs minimal-project fixture", () => {
  it("conforms to ProjectSchema", () => {
    const result = ProjectSchema.safeParse(fixture);
    if (!result.success) console.error(result.error.flatten());
    expect(result.success).toBe(true);
  });
});
