import { describe, it, expect } from "vitest";
import { EasingSchema } from "@/schemas/easing";
import { KeyframeSchema, VolumeKeyframeSchema } from "@/schemas/keyframe";
import { LayerSchema } from "@/schemas/layer";
describe("EasingSchema", () => {
  it("accepts linear", () => {
    expect(EasingSchema.safeParse({ type: "linear" }).success).toBe(true);
  });
  it("accepts cubic-bezier with 4 params", () => {
    expect(EasingSchema.safeParse({ type: "cubic-bezier", params: [0.25, 0.1, 0.25, 1] }).success).toBe(true);
  });
  it("accepts spring with damping/stiffness/mass", () => {
    expect(EasingSchema.safeParse({ type: "spring", params: { damping: 10, stiffness: 100, mass: 1 } }).success).toBe(true);
  });
  it("rejects unknown type", () => {
    expect(EasingSchema.safeParse({ type: "magic" }).success).toBe(false);
  });
  it("rejects cubic-bezier with wrong arity", () => {
    expect(EasingSchema.safeParse({ type: "cubic-bezier", params: [0, 1] }).success).toBe(false);
  });
});

describe("KeyframeSchema", () => {
  it("(a) accepts a valid keyframe with linear easingOut", () => {
    expect(
      KeyframeSchema.safeParse({
        frame: 0,
        property: "opacity",
        value: "1",
        easingOut: { type: "linear" }
      }).success
    ).toBe(true);
  });
  it("(b) rejects negative frame", () => {
    expect(
      KeyframeSchema.safeParse({
        frame: -1,
        property: "opacity",
        value: "1",
        easingOut: { type: "linear" }
      }).success
    ).toBe(false);
  });
  it("(c) rejects empty property", () => {
    expect(
      KeyframeSchema.safeParse({
        frame: 0,
        property: "",
        value: "1",
        easingOut: { type: "linear" }
      }).success
    ).toBe(false);
  });
  it("(d) rejects bad easingOut", () => {
    expect(
      KeyframeSchema.safeParse({
        frame: 0,
        property: "opacity",
        value: "1",
        easingOut: { type: "unknown-easing" }
      }).success
    ).toBe(false);
  });
});

describe("VolumeKeyframeSchema", () => {
  it("(a) accepts a valid volume keyframe", () => {
    expect(
      VolumeKeyframeSchema.safeParse({
        frame: 10,
        value: 0.5,
        easingOut: { type: "linear" }
      }).success
    ).toBe(true);
  });
  it("(b) rejects value > 1", () => {
    expect(
      VolumeKeyframeSchema.safeParse({
        frame: 0,
        value: 1.1,
        easingOut: { type: "linear" }
      }).success
    ).toBe(false);
  });
  it("(c) rejects value < 0", () => {
    expect(
      VolumeKeyframeSchema.safeParse({
        frame: 0,
        value: -0.1,
        easingOut: { type: "linear" }
      }).success
    ).toBe(false);
  });
});

describe("LayerSchema", () => {
  it("accepts a valid layer", () => {
    expect(
      LayerSchema.safeParse({
        id: "L1",
        order: 0,
        name: "Title",
        html: '<div class="title">hello</div>',
        css: ".title { color: red; }",
        startFrame: 0,
        endFrame: 30,
        keyframes: []
      }).success
    ).toBe(true);
  });

  it("rejects when endFrame < startFrame", () => {
    expect(
      LayerSchema.safeParse({
        id: "L1",
        order: 0,
        name: "Title",
        html: "<div>hello</div>",
        css: "",
        startFrame: 10,
        endFrame: 5,
        keyframes: []
      }).success
    ).toBe(false);
  });

  it("rejects when html field is missing entirely (empty string is allowed)", () => {
    expect(
      LayerSchema.safeParse({
        id: "L1",
        order: 0,
        name: "Title",
        css: "",
        startFrame: 0,
        endFrame: 30,
        keyframes: []
      }).success
    ).toBe(false);

    // empty string IS valid
    expect(
      LayerSchema.safeParse({
        id: "L1",
        order: 0,
        name: "Title",
        html: "",
        css: "",
        startFrame: 0,
        endFrame: 30,
        keyframes: []
      }).success
    ).toBe(true);
  });
});
