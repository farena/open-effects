import { describe, it, expect } from "vitest";
import { buildPresetKeyframes } from "@/editor/presets/build-keyframes";
import { ANIMATION_PRESETS } from "@/editor/presets/animation-presets";
import type { AnimationPreset, BuildContext } from "@/editor/presets/types";
import type { Layer, Easing } from "@open-effects/shared-types";

const LINEAR_EASING: Easing = { type: "linear" };

/** A minimal stub layer for testing. */
function makeLayer(startFrame: number, endFrame: number): Layer {
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
    keyframes: [],
  };
}

/**
 * Stub preset: returns 2 keyframes at anchor and anchor+duration for "opacity".
 * Does NOT include id (builder assigns ids).
 */
function makeStubPreset(category: AnimationPreset["category"]): AnimationPreset {
  return {
    key: `stub-${category}`,
    name: `Stub ${category}`,
    category,
    iconKey: "eye",
    defaultDuration: 30,
    defaultEasing: LINEAR_EASING,
    params: [],
    animatedProperties: ["opacity"],
    build: (ctx) => [
      {
        frame: ctx.anchorFrame,
        property: "opacity",
        value: "0",
        easingOut: { type: "linear" },
      },
      {
        frame: ctx.anchorFrame + ctx.duration,
        property: "opacity",
        value: "1",
        easingOut: { type: "linear" },
      },
    ],
  };
}

describe("buildPresetKeyframes", () => {
  // ── IN category ─────────────────────────────────────────────────────────────
  it("IN preset: anchorFrame === layer.startFrame", () => {
    const layer = makeLayer(10, 100);
    const preset = makeStubPreset("in");
    const ctx: BuildContext = {
      layer,
      duration: 30,
      easing: LINEAR_EASING,
      anchorFrame: -1, // sentinel — should be overridden
      values: {},
    };

    const kfs = buildPresetKeyframes(preset, ctx);
    expect(kfs[0].frame).toBe(10); // layer.startFrame
  });

  // ── OUT category — normal (duration fits) ──────────────────────────────────
  it("OUT preset: anchorFrame === layer.endFrame - duration when duration fits", () => {
    const layer = makeLayer(0, 100);
    const preset = makeStubPreset("out");
    const ctx: BuildContext = {
      layer,
      duration: 30,
      easing: LINEAR_EASING,
      anchorFrame: -1,
      values: {},
    };

    const kfs = buildPresetKeyframes(preset, ctx);
    // anchor = 100 - 30 = 70; last kf = 70 + 30 = 100
    expect(kfs[0].frame).toBe(70);
    expect(kfs[1].frame).toBe(100);
  });

  // ── OUT category — clamped (duration > layer length) ───────────────────────
  it("OUT preset: duration clamped when exceeds layer length; anchorFrame === layer.startFrame", () => {
    const layer = makeLayer(10, 30); // length = 20
    const preset = makeStubPreset("out");
    const ctx: BuildContext = {
      layer,
      duration: 50, // exceeds layer length
      easing: LINEAR_EASING,
      anchorFrame: -1,
      values: {},
    };

    const kfs = buildPresetKeyframes(preset, ctx);
    // clamped duration = 20; anchor = max(10 - 20, 10) = 10 = startFrame
    expect(kfs[0].frame).toBe(10);
    expect(kfs[1].frame).toBe(30); // startFrame + clampedDuration = 10 + 20
  });

  // ── EFFECT category — explicit anchorFrame ──────────────────────────────────
  it("EFFECT preset: uses caller-provided anchorFrame", () => {
    const layer = makeLayer(0, 120);
    const preset = makeStubPreset("effect");
    const ctx: BuildContext = {
      layer,
      duration: 20,
      easing: LINEAR_EASING,
      anchorFrame: 40, // explicit
      values: {},
    };

    const kfs = buildPresetKeyframes(preset, ctx);
    expect(kfs[0].frame).toBe(40);
    expect(kfs[1].frame).toBe(60);
  });

  // ── EFFECT category — default midpoint ──────────────────────────────────────
  it("EFFECT preset: uses midpoint when anchorFrame is -1 (sentinel)", () => {
    const layer = makeLayer(0, 120);
    const preset = makeStubPreset("effect");
    const ctx: BuildContext = {
      layer,
      duration: 20,
      easing: LINEAR_EASING,
      anchorFrame: -1, // sentinel → should compute midpoint
      values: {},
    };

    const kfs = buildPresetKeyframes(preset, ctx);
    // midpoint = floor((0 + 120) / 2) = 60
    expect(kfs[0].frame).toBe(60);
    expect(kfs[1].frame).toBe(80);
  });

  // ── ids assigned ─────────────────────────────────────────────────────────────
  it("all returned keyframes have non-empty string ids", () => {
    const layer = makeLayer(0, 120);
    const preset = makeStubPreset("in");
    const ctx: BuildContext = {
      layer,
      duration: 30,
      easing: LINEAR_EASING,
      anchorFrame: -1,
      values: {},
    };

    const kfs = buildPresetKeyframes(preset, ctx);
    for (const kf of kfs) {
      expect(typeof kf.id).toBe("string");
      expect(kf.id!.length).toBeGreaterThan(0);
    }
  });

  // ── frames in range ───────────────────────────────────────────────────────────
  it("all returned frames are within [layer.startFrame, layer.endFrame]", () => {
    const layer = makeLayer(5, 80);
    const preset = makeStubPreset("in");
    const ctx: BuildContext = {
      layer,
      duration: 30,
      easing: LINEAR_EASING,
      anchorFrame: -1,
      values: {},
    };

    const kfs = buildPresetKeyframes(preset, ctx);
    for (const kf of kfs) {
      expect(kf.frame).toBeGreaterThanOrEqual(layer.startFrame);
      expect(kf.frame).toBeLessThanOrEqual(layer.endFrame);
    }
  });
});

// ── Catalog smoke test (iterates ANIMATION_PRESETS) ───────────────────────────
describe("ANIMATION_PRESETS catalog smoke", () => {
  const layer = makeLayer(0, 120);
  const EASING: Easing = { type: "ease-out" };

  it("every preset produces ≥2 keyframes with default params on a 120-frame layer", () => {
    for (const preset of ANIMATION_PRESETS) {
      // Build default values from params
      const values: Record<string, number | string> = {};
      for (const p of preset.params) {
        values[p.key] = p.default;
      }

      const ctx: BuildContext = {
        layer,
        duration: preset.defaultDuration,
        easing: EASING,
        anchorFrame: -1, // sentinel
        values,
      };

      const kfs = buildPresetKeyframes(preset, ctx);
      expect(kfs.length, `${preset.key}: expected ≥2 keyframes`).toBeGreaterThanOrEqual(2);
    }
  });

  it("every preset: all returned easingOut equal ctx.easing", () => {
    for (const preset of ANIMATION_PRESETS) {
      const values: Record<string, number | string> = {};
      for (const p of preset.params) {
        values[p.key] = p.default;
      }

      const ctx: BuildContext = {
        layer,
        duration: preset.defaultDuration,
        easing: EASING,
        anchorFrame: -1,
        values,
      };

      const kfs = buildPresetKeyframes(preset, ctx);
      for (const kf of kfs) {
        expect(kf.easingOut, `${preset.key}: easingOut should equal ctx.easing`).toEqual(EASING);
      }
    }
  });

  it("every preset: all returned frames in range [startFrame, endFrame]", () => {
    for (const preset of ANIMATION_PRESETS) {
      const values: Record<string, number | string> = {};
      for (const p of preset.params) {
        values[p.key] = p.default;
      }

      const ctx: BuildContext = {
        layer,
        duration: preset.defaultDuration,
        easing: EASING,
        anchorFrame: -1,
        values,
      };

      const kfs = buildPresetKeyframes(preset, ctx);
      for (const kf of kfs) {
        expect(kf.frame, `${preset.key}: frame ${kf.frame} out of range`).toBeGreaterThanOrEqual(layer.startFrame);
        expect(kf.frame, `${preset.key}: frame ${kf.frame} out of range`).toBeLessThanOrEqual(layer.endFrame);
      }
    }
  });

  it("every preset: no id is undefined after buildPresetKeyframes", () => {
    for (const preset of ANIMATION_PRESETS) {
      const values: Record<string, number | string> = {};
      for (const p of preset.params) {
        values[p.key] = p.default;
      }

      const ctx: BuildContext = {
        layer,
        duration: preset.defaultDuration,
        easing: EASING,
        anchorFrame: -1,
        values,
      };

      const kfs = buildPresetKeyframes(preset, ctx);
      for (const kf of kfs) {
        expect(kf.id, `${preset.key}: id should not be undefined`).toBeDefined();
        expect(typeof kf.id).toBe("string");
        expect(kf.id!.length).toBeGreaterThan(0);
      }
    }
  });

  it("ANIMATION_PRESETS.length === 24 (after Task 5b additions)", () => {
    expect(ANIMATION_PRESETS.length).toBe(24);
  });

  it("category counts: 9 IN, 8 OUT, 7 EFFECT", () => {
    const inCount = ANIMATION_PRESETS.filter((p) => p.category === "in").length;
    const outCount = ANIMATION_PRESETS.filter((p) => p.category === "out").length;
    const effectCount = ANIMATION_PRESETS.filter((p) => p.category === "effect").length;
    expect(inCount).toBe(9);
    expect(outCount).toBe(8);
    expect(effectCount).toBe(7);
  });
});
