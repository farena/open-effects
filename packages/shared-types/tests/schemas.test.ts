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

import { AssetSchema, AudioTrackSchema } from "@/schemas/audio";

describe("AssetSchema", () => {
  it("accepts a valid asset", () => {
    expect(
      AssetSchema.safeParse({
        id: "a1",
        type: "image",
        filename: "photo.png",
        path: "/assets/photo.png",
        mimeType: "image/png",
        size: 1024
      }).success
    ).toBe(true);
  });

  it("rejects type='banana'", () => {
    expect(
      AssetSchema.safeParse({
        id: "a1",
        type: "banana",
        filename: "photo.png",
        path: "/assets/photo.png",
        mimeType: "image/png",
        size: 1024
      }).success
    ).toBe(false);
  });

  it("rejects size <= 0", () => {
    expect(
      AssetSchema.safeParse({
        id: "a1",
        type: "image",
        filename: "photo.png",
        path: "/assets/photo.png",
        mimeType: "image/png",
        size: 0
      }).success
    ).toBe(false);

    expect(
      AssetSchema.safeParse({
        id: "a1",
        type: "image",
        filename: "photo.png",
        path: "/assets/photo.png",
        mimeType: "image/png",
        size: -5
      }).success
    ).toBe(false);
  });
});

describe("AudioTrackSchema", () => {
  it("accepts a valid track with volumeKeyframes defaulting to []", () => {
    const result = AudioTrackSchema.safeParse({
      id: "t1",
      assetId: "a1",
      assetPath: "/assets/track.mp3",
      startFrame: 0,
      trimStart: 0,
      trimEnd: 30
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.volumeKeyframes).toEqual([]);
    }
  });

  it("accepts a valid track with optional eq", () => {
    expect(
      AudioTrackSchema.safeParse({
        id: "t1",
        assetId: "a1",
        assetPath: "/assets/track.mp3",
        startFrame: 0,
        trimStart: 0,
        trimEnd: 30,
        eq: { low: 0, mid: 0, high: 0, presence: 0 }
      }).success
    ).toBe(true);
  });

  it("rejects trimEnd <= trimStart", () => {
    expect(
      AudioTrackSchema.safeParse({
        id: "t1",
        assetId: "a1",
        assetPath: "/assets/track.mp3",
        startFrame: 0,
        trimStart: 10,
        trimEnd: 10
      }).success
    ).toBe(false);

    expect(
      AudioTrackSchema.safeParse({
        id: "t1",
        assetId: "a1",
        assetPath: "/assets/track.mp3",
        startFrame: 0,
        trimStart: 10,
        trimEnd: 5
      }).success
    ).toBe(false);
  });
});

import { SceneSchema } from "@/schemas/scene";

describe("SceneSchema", () => {
  const validLayer = {
    id: "L1",
    order: 0,
    name: "Title",
    html: "<div>hello</div>",
    css: "",
    startFrame: 0,
    endFrame: 30,
    keyframes: []
  };

  const validAudioTrack = {
    id: "t1",
    assetId: "a1",
    assetPath: "/assets/track.mp3",
    startFrame: 0,
    trimStart: 0,
    trimEnd: 30
  };

  it("(a) accepts valid minimal scene (no transitionIn, no layers/audio)", () => {
    expect(
      SceneSchema.safeParse({
        id: "s1",
        order: 0,
        durationFrames: 30
      }).success
    ).toBe(true);
  });

  it("accepts valid scene with layers and audioTracks", () => {
    expect(
      SceneSchema.safeParse({
        id: "s1",
        order: 0,
        durationFrames: 30,
        layers: [validLayer],
        audioTracks: [validAudioTrack]
      }).success
    ).toBe(true);
  });

  it("(b) rejects durationFrames = 0", () => {
    expect(
      SceneSchema.safeParse({
        id: "s1",
        order: 0,
        durationFrames: 0
      }).success
    ).toBe(false);
  });

  it("(c) rejects durationFrames = -1", () => {
    expect(
      SceneSchema.safeParse({
        id: "s1",
        order: 0,
        durationFrames: -1
      }).success
    ).toBe(false);
  });

  it("(d) accepts transitionIn with type 'fade'", () => {
    expect(
      SceneSchema.safeParse({
        id: "s1",
        order: 0,
        durationFrames: 30,
        transitionIn: { type: "fade" }
      }).success
    ).toBe(true);
  });

  it("(e) rejects transitionIn type 'spin'", () => {
    expect(
      SceneSchema.safeParse({
        id: "s1",
        order: 0,
        durationFrames: 30,
        transitionIn: { type: "spin" }
      }).success
    ).toBe(false);
  });

  it("accepts transitionIn = null (nullable)", () => {
    expect(
      SceneSchema.safeParse({
        id: "s1",
        order: 0,
        durationFrames: 30,
        transitionIn: null
      }).success
    ).toBe(true);
  });

  it("transitionIn durationFrames defaults to 15 when omitted", () => {
    const result = SceneSchema.safeParse({
      id: "s1",
      order: 0,
      durationFrames: 30,
      transitionIn: { type: "slide-left" }
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transitionIn?.durationFrames).toBe(15);
    }
  });
});

import { ProjectSchema } from "@/schemas/project";

describe("ProjectSchema", () => {
  const validScene = {
    id: "s1",
    order: 0,
    durationFrames: 30
  };

  it("(a) accepts a valid project with 0 scenes", () => {
    expect(
      ProjectSchema.safeParse({
        id: "p1",
        name: "My Project",
        width: 1920,
        height: 1080,
        fps: 30
      }).success
    ).toBe(true);
  });

  it("(b) accepts a valid project with 2 scenes", () => {
    const scene2 = { id: "s2", order: 1, durationFrames: 60 };
    expect(
      ProjectSchema.safeParse({
        id: "p1",
        name: "My Project",
        width: 1920,
        height: 1080,
        fps: 24,
        scenes: [validScene, scene2]
      }).success
    ).toBe(true);
  });

  it("(c) rejects width = -1", () => {
    expect(
      ProjectSchema.safeParse({
        id: "p1",
        name: "My Project",
        width: -1,
        height: 1080,
        fps: 30
      }).success
    ).toBe(false);
  });

  it("(d) rejects height = 0", () => {
    expect(
      ProjectSchema.safeParse({
        id: "p1",
        name: "My Project",
        width: 1920,
        height: 0,
        fps: 30
      }).success
    ).toBe(false);
  });

  it("(e) rejects fps = 25", () => {
    expect(
      ProjectSchema.safeParse({
        id: "p1",
        name: "My Project",
        width: 1920,
        height: 1080,
        fps: 25
      }).success
    ).toBe(false);
  });

  it("rejects fps = 0", () => {
    expect(
      ProjectSchema.safeParse({
        id: "p1",
        name: "My Project",
        width: 1920,
        height: 1080,
        fps: 0
      }).success
    ).toBe(false);
  });

  it("rejects fps = 100", () => {
    expect(
      ProjectSchema.safeParse({
        id: "p1",
        name: "My Project",
        width: 1920,
        height: 1080,
        fps: 100
      }).success
    ).toBe(false);
  });

  it("rejects empty name", () => {
    expect(
      ProjectSchema.safeParse({
        id: "p1",
        name: "",
        width: 1920,
        height: 1080,
        fps: 30
      }).success
    ).toBe(false);
  });

  it("scenes defaults to [] when omitted", () => {
    const result = ProjectSchema.safeParse({
      id: "p1",
      name: "My Project",
      width: 1920,
      height: 1080,
      fps: 60
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scenes).toEqual([]);
    }
  });
});
