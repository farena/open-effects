import { describe, it, expect } from "vitest";
import { instantiatePayload } from "@/lib/components/instantiatePayload";
import type { SavedComponentPayload } from "@open-effects/shared-types";

function makePayload(
  layers: Array<{
    id: string;
    startFrame: number;
    endFrame: number;
    order: number;
    keyframes?: Array<{ id?: string; frame: number }>;
  }>,
): SavedComponentPayload {
  return {
    layers: layers.map((l) => {
      const { keyframes: kfInput, ...rest } = l;
      return {
        type: "html" as const,
        name: "layer",
        html: "",
        css: "",
        visible: true,
        ...rest,
        keyframes: (kfInput ?? []).map((k) => ({
          id: k.id,
          frame: k.frame,
          property: "opacity",
          value: "1",
          easingOut: { type: "linear" as const },
        })),
      };
    }),
  };
}

describe("instantiatePayload", () => {
  it("single layer at [0,30] instantiated at currentFrame:100 → [100,130]", () => {
    const payload = makePayload([
      { id: "src-layer-1", order: 0, startFrame: 0, endFrame: 30 },
    ]);

    const result = instantiatePayload(payload, {
      currentFrame: 100,
      existingMaxOrder: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].startFrame).toBe(100);
    expect(result[0].endFrame).toBe(130);
    expect(result[0].id).not.toBe("src-layer-1");
  });

  it("two layers at [0,20] and [7,55] at currentFrame:50 → [50,70] and [57,105]", () => {
    const payload = makePayload([
      { id: "src-a", order: 0, startFrame: 0, endFrame: 20 },
      { id: "src-b", order: 1, startFrame: 7, endFrame: 55 },
    ]);

    const result = instantiatePayload(payload, {
      currentFrame: 50,
      existingMaxOrder: 2,
    });

    expect(result).toHaveLength(2);
    expect(result[0].startFrame).toBe(50);
    expect(result[0].endFrame).toBe(70);
    expect(result[1].startFrame).toBe(57);
    expect(result[1].endFrame).toBe(105);
  });

  it("each keyframe in new layers gets a fresh id different from the payload keyframe ids", () => {
    const payload = makePayload([
      {
        id: "src-layer-1",
        order: 0,
        startFrame: 0,
        endFrame: 30,
        keyframes: [
          { id: "kf-1", frame: 0 },
          { id: "kf-2", frame: 15 },
        ],
      },
    ]);

    const result = instantiatePayload(payload, {
      currentFrame: 0,
      existingMaxOrder: 0,
    });

    expect(result[0].keyframes).toHaveLength(2);
    expect(result[0].keyframes[0].id).not.toBe("kf-1");
    expect(result[0].keyframes[1].id).not.toBe("kf-2");
    expect(result[0].keyframes[0].id).toBeTruthy();
    expect(result[0].keyframes[1].id).toBeTruthy();
  });

  it("existingMaxOrder honored: layers get order = existingMaxOrder + 1, +2, ...", () => {
    const payload = makePayload([
      { id: "src-a", order: 0, startFrame: 0, endFrame: 10 },
      { id: "src-b", order: 1, startFrame: 0, endFrame: 10 },
      { id: "src-c", order: 2, startFrame: 0, endFrame: 10 },
    ]);

    const result = instantiatePayload(payload, {
      currentFrame: 0,
      existingMaxOrder: 5,
    });

    expect(result[0].order).toBe(6);
    expect(result[1].order).toBe(7);
    expect(result[2].order).toBe(8);
  });

  it("calling instantiatePayload twice produces non-equal layer ids", () => {
    const payload = makePayload([
      { id: "src-layer-1", order: 0, startFrame: 0, endFrame: 10 },
    ]);

    const first = instantiatePayload(payload, {
      currentFrame: 0,
      existingMaxOrder: 0,
    });
    const second = instantiatePayload(payload, {
      currentFrame: 0,
      existingMaxOrder: 0,
    });

    expect(first[0].id).not.toBe(second[0].id);
  });
});
