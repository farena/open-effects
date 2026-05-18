import { describe, it, expect } from "vitest";
import { normalizePayload } from "@/lib/components/normalizePayload";
import type { Layer } from "@open-effects/shared-types";

function makeLayer(
  overrides: Omit<Partial<Layer>, "type"> & {
    id: string;
    order: number;
    startFrame: number;
    endFrame: number;
  },
): Layer {
  return {
    type: "html" as const,
    name: "layer",
    html: "",
    css: "",
    visible: true,
    keyframes: [],
    ...overrides,
  };
}

describe("normalizePayload", () => {
  it("single layer: shifts startFrame to 0 and adjusts endFrame accordingly", () => {
    const layer = makeLayer({
      id: "a",
      order: 0,
      startFrame: 10,
      endFrame: 40,
      keyframes: [
        {
          frame: 0,
          property: "opacity",
          value: "1",
          easingOut: { type: "linear" },
        },
        {
          frame: 15,
          property: "opacity",
          value: "0.5",
          easingOut: { type: "linear" },
        },
        {
          frame: 30,
          property: "opacity",
          value: "0",
          easingOut: { type: "linear" },
        },
      ],
    });

    const result = normalizePayload([layer]);

    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].startFrame).toBe(0);
    expect(result.layers[0].endFrame).toBe(30);
    // keyframes unchanged
    expect(result.layers[0].keyframes).toHaveLength(3);
    expect(result.layers[0].keyframes[0].frame).toBe(0);
    expect(result.layers[0].keyframes[1].frame).toBe(15);
    expect(result.layers[0].keyframes[2].frame).toBe(30);
  });

  it("two layers: shifts both by minStart", () => {
    const layerA = makeLayer({
      id: "a",
      order: 0,
      startFrame: 5,
      endFrame: 25,
    });
    const layerB = makeLayer({
      id: "b",
      order: 1,
      startFrame: 12,
      endFrame: 60,
    });

    const result = normalizePayload([layerA, layerB]);

    expect(result.layers).toHaveLength(2);
    // minStart = 5
    expect(result.layers[0].startFrame).toBe(0);
    expect(result.layers[0].endFrame).toBe(20);
    expect(result.layers[1].startFrame).toBe(7);
    expect(result.layers[1].endFrame).toBe(55);
  });

  it("re-numbers order starting at 0 after sorting by original order", () => {
    const layerC = makeLayer({
      id: "c",
      order: 5,
      startFrame: 0,
      endFrame: 10,
    });
    const layerA = makeLayer({
      id: "a",
      order: 1,
      startFrame: 0,
      endFrame: 10,
    });
    const layerB = makeLayer({
      id: "b",
      order: 3,
      startFrame: 0,
      endFrame: 10,
    });

    const result = normalizePayload([layerC, layerA, layerB]);

    expect(result.layers).toHaveLength(3);
    // sorted by original order: A(1), B(3), C(5)
    expect(result.layers[0].id).toBe("a");
    expect(result.layers[0].order).toBe(0);
    expect(result.layers[1].id).toBe("b");
    expect(result.layers[1].order).toBe(1);
    expect(result.layers[2].id).toBe("c");
    expect(result.layers[2].order).toBe(2);
  });

  it("preserves layer IDs in the payload", () => {
    const layer = makeLayer({
      id: "my-unique-id",
      order: 0,
      startFrame: 0,
      endFrame: 10,
    });
    const result = normalizePayload([layer]);
    expect(result.layers[0].id).toBe("my-unique-id");
  });

  it("throws when given an empty array", () => {
    expect(() => normalizePayload([])).toThrow(
      "normalizePayload requires ≥1 layer",
    );
  });

  it("preserves a layer with empty keyframes", () => {
    const layer = makeLayer({
      id: "a",
      order: 0,
      startFrame: 0,
      endFrame: 10,
      keyframes: [],
    });
    const result = normalizePayload([layer]);
    expect(result.layers[0].keyframes).toEqual([]);
  });
});
