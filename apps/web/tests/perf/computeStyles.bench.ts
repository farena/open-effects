/**
 * Performance benchmark for computeStylesAtFrame.
 *
 * Synthetic project: 30 layers × 1 scene, each layer has 50 keyframes spread
 * across the property whitelist.
 *
 * Loops frame in [0..900] calling computeStylesAtFrame for each layer.
 * Prints: total ms, average per-frame-call ms.
 *
 * Budget: average per-layer-per-frame call < ~1 ms
 * (30 layers × 1 ms = 30 ms inside 33 ms budget at 30 fps).
 */
import { describe, it, expect } from "vitest";
import type { Keyframe } from "@open-effects/shared-types";
import { computeStylesAtFrame, ANIMATABLE_KEYS } from "@open-effects/runtime";

const FPS = 30;
const TOTAL_FRAMES = 900; // 30 s @ 30 fps
const NUM_LAYERS = 30;
const KEYFRAMES_PER_LAYER = 50;

function buildLayerKeyframes(layerIndex: number): Keyframe[] {
  const keyframes: Keyframe[] = [];
  const propCount = ANIMATABLE_KEYS.length; // 12 properties in whitelist

  // Spread 50 keyframes across the available properties.
  // Each property gets ~4 keyframes distributed evenly across the timeline.
  for (let i = 0; i < KEYFRAMES_PER_LAYER; i++) {
    const propKey = ANIMATABLE_KEYS[i % propCount];
    const propKfIndex = Math.floor(i / propCount); // which keyframe within this property
    const totalKfsPerProp = Math.ceil(KEYFRAMES_PER_LAYER / propCount);
    const frame = Math.round(
      (propKfIndex / (totalKfsPerProp - 1 || 1)) * TOTAL_FRAMES,
    );
    const easingTypes = [
      "linear",
      "ease-in",
      "ease-out",
      "ease-in-out",
    ] as const;
    const easingOut: Keyframe["easingOut"] = {
      type: easingTypes[i % easingTypes.length],
    };

    // Pick a plausible value per property key
    let value: string;
    if (propKey.startsWith("transform.translate")) {
      value = `${(layerIndex + propKfIndex) * 10}px`;
    } else if (propKey === "transform.scale") {
      value = `${1 + propKfIndex * 0.1}`;
    } else if (propKey === "transform.rotate") {
      value = `${propKfIndex * 30}deg`;
    } else if (propKey === "opacity") {
      value = `${Math.min(1, propKfIndex * 0.2)}`;
    } else if (propKey === "color" || propKey === "background-color") {
      value = `rgba(${(layerIndex * 10 + propKfIndex * 20) % 256},100,200,1)`;
    } else if (
      propKey === "border-radius" ||
      propKey === "width" ||
      propKey === "height" ||
      propKey === "top" ||
      propKey === "left"
    ) {
      value = `${propKfIndex * 20}px`;
    } else {
      value = `${propKfIndex}`;
    }

    keyframes.push({ frame, property: propKey, value, easingOut });
  }

  return keyframes;
}

describe("computeStylesAtFrame – performance bench", () => {
  it("meets the <1 ms per-layer-per-frame budget over 30 layers × 900 frames", () => {
    // Build synthetic keyframes for 30 layers once.
    const allLayerKeyframes: Keyframe[][] = Array.from(
      { length: NUM_LAYERS },
      (_, i) => buildLayerKeyframes(i),
    );

    // Warm-up pass to avoid JIT cold-start skewing results.
    for (const kfs of allLayerKeyframes) {
      computeStylesAtFrame(kfs, 0, FPS);
    }

    // Measured pass.
    const start = performance.now();
    let calls = 0;

    for (let frame = 0; frame <= TOTAL_FRAMES; frame++) {
      for (const kfs of allLayerKeyframes) {
        computeStylesAtFrame(kfs, frame, FPS);
        calls++;
      }
    }

    const totalMs = performance.now() - start;
    const avgMsPerCall = totalMs / calls;

    console.log(`[computeStylesAtFrame bench]`);
    console.log(`  layers          : ${NUM_LAYERS}`);
    console.log(`  frames          : ${TOTAL_FRAMES + 1}`);
    console.log(`  total calls     : ${calls}`);
    console.log(`  total ms        : ${totalMs.toFixed(2)}`);
    console.log(`  avg ms/call     : ${avgMsPerCall.toFixed(4)}`);
    console.log(`  budget          : <1.00 ms/call`);
    console.log(
      `  budget met      : ${avgMsPerCall < 1 ? "YES" : "NO – OPTIMIZATION NEEDED"}`,
    );

    // Assert budget: average per-layer-per-frame < 1 ms.
    expect(avgMsPerCall).toBeLessThan(1);
  });
});
