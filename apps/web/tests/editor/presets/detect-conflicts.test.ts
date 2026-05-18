import { describe, it, expect } from "vitest";
import { detectPresetConflicts } from "@/editor/presets/detect-conflicts";
import type { AnimationPreset, BuildContext } from "@/editor/presets/types";
import type { Layer, Easing, Keyframe } from "@open-effects/shared-types";

const LINEAR_EASING: Easing = { type: "linear" };

function makeLayer(
  startFrame: number,
  endFrame: number,
  keyframes: Keyframe[] = [],
): Layer {
  return {
    type: "html",
    id: "layer-1",
    order: 0,
    name: "Test Layer",
    html: "",
    css: "",
    startFrame,
    endFrame,
    visible: true,
    keyframes,
  };
}

function makePreset(
  category: AnimationPreset["category"],
  animatedProperties: string[],
): AnimationPreset {
  return {
    key: `stub-${category}`,
    name: `Stub ${category}`,
    category,
    iconKey: "eye",
    defaultDuration: 30,
    defaultEasing: LINEAR_EASING,
    params: [],
    animatedProperties,
    build: (ctx) => [
      {
        frame: ctx.anchorFrame,
        property: animatedProperties[0] ?? "opacity",
        value: "0",
        easingOut: { type: "linear" },
      },
      {
        frame: ctx.anchorFrame + ctx.duration,
        property: animatedProperties[0] ?? "opacity",
        value: "1",
        easingOut: { type: "linear" },
      },
    ],
  };
}

function makeCtx(
  layer: Layer,
  overrides: Partial<BuildContext> = {},
): BuildContext {
  return {
    layer,
    duration: 30,
    easing: LINEAR_EASING,
    anchorFrame: -1, // sentinel → midpoint or category-based
    values: {},
    ...overrides,
  };
}

describe("detectPresetConflicts", () => {
  // ── no keyframes ─────────────────────────────────────────────────────────────
  it("returns [] when layer has no keyframes", () => {
    const layer = makeLayer(0, 120);
    const preset = makePreset("in", ["opacity"]);
    const ctx = makeCtx(layer, { duration: 30 });

    const conflicts = detectPresetConflicts(layer, preset, ctx);
    expect(conflicts).toEqual([]);
  });

  // ── keyframe outside range ────────────────────────────────────────────────────
  it("returns [] when existing keyframe on same property is outside [anchor, anchor+duration]", () => {
    const kf: Keyframe = {
      id: "kf-1",
      frame: 50, // outside [0, 30]
      property: "opacity",
      value: "0.5",
      easingOut: LINEAR_EASING,
    };
    const layer = makeLayer(0, 120, [kf]);
    const preset = makePreset("in", ["opacity"]);
    // IN → anchor = startFrame = 0; range = [0, 30]
    const ctx = makeCtx(layer, { duration: 30 });

    const conflicts = detectPresetConflicts(layer, preset, ctx);
    expect(conflicts).toEqual([]);
  });

  // ── keyframe inside range with matching property ──────────────────────────────
  it("returns one conflict when existing keyframe is inside range for a matching property", () => {
    const kf: Keyframe = {
      id: "kf-1",
      frame: 15, // inside [0, 30]
      property: "opacity",
      value: "0.5",
      easingOut: LINEAR_EASING,
    };
    const layer = makeLayer(0, 120, [kf]);
    const preset = makePreset("in", ["opacity"]);
    const ctx = makeCtx(layer, { duration: 30 });

    const conflicts = detectPresetConflicts(layer, preset, ctx);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].property).toBe("opacity");
    expect(conflicts[0].existingFrames).toEqual([15]);
  });

  // ── multiple properties, only animatedProperties returned ─────────────────────
  it("returns only conflicts for properties in animatedProperties, even when others overlap", () => {
    const kfOpacity: Keyframe = {
      id: "kf-1",
      frame: 10, // inside [0, 30]
      property: "opacity",
      value: "0.5",
      easingOut: LINEAR_EASING,
    };
    const kfTranslate: Keyframe = {
      id: "kf-2",
      frame: 20, // inside [0, 30]
      property: "transform.translateX",
      value: "100px",
      easingOut: LINEAR_EASING,
    };
    const kfScale: Keyframe = {
      id: "kf-3",
      frame: 25, // inside [0, 30]
      property: "transform.scale",
      value: "1.5",
      easingOut: LINEAR_EASING,
    };
    const layer = makeLayer(0, 120, [kfOpacity, kfTranslate, kfScale]);

    // Preset only animates opacity and transform.translateX, not transform.scale
    const preset = makePreset("in", ["opacity", "transform.translateX"]);
    const ctx = makeCtx(layer, { duration: 30 });

    const conflicts = detectPresetConflicts(layer, preset, ctx);
    expect(conflicts).toHaveLength(2);

    const properties = conflicts.map((c) => c.property).sort();
    expect(properties).toEqual(["opacity", "transform.translateX"]);

    const opacityConflict = conflicts.find((c) => c.property === "opacity")!;
    expect(opacityConflict.existingFrames).toEqual([10]);

    const translateConflict = conflicts.find(
      (c) => c.property === "transform.translateX",
    )!;
    expect(translateConflict.existingFrames).toEqual([20]);
  });

  // ── multiple keyframes on same property ───────────────────────────────────────
  it("groups multiple keyframes for the same property into a single conflict", () => {
    const kf1: Keyframe = {
      id: "kf-1",
      frame: 5,
      property: "opacity",
      value: "0",
      easingOut: LINEAR_EASING,
    };
    const kf2: Keyframe = {
      id: "kf-2",
      frame: 20,
      property: "opacity",
      value: "0.5",
      easingOut: LINEAR_EASING,
    };
    const layer = makeLayer(0, 120, [kf1, kf2]);
    const preset = makePreset("in", ["opacity"]);
    const ctx = makeCtx(layer, { duration: 30 });

    const conflicts = detectPresetConflicts(layer, preset, ctx);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].property).toBe("opacity");
    expect(conflicts[0].existingFrames).toEqual([5, 20]);
  });
});
