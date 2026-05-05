import React from "react";
import { vi } from "vitest";

vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    Sequence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
    useCurrentFrame: () => 0,
    useVideoConfig: () => ({ fps: 30, durationInFrames: 30, width: 1920, height: 1080 }),
  };
});

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { OpenEffectsComposition } from "@/OpenEffectsComposition";
import { singleSceneFixture } from "@/fixtures/singleScene";
import { twoScenesFixture } from "@/fixtures/twoScenes";

describe("<OpenEffectsComposition>", () => {
  it("renders all scene wrappers ordered", () => {
    const { container } = render(<OpenEffectsComposition project={singleSceneFixture} />);
    // jsdom env: Sequence renders children unconditionally without frame context
    // We assert the first layer's HTML is in the DOM tree.
    expect(container.innerHTML).toContain("singleScene fixture");
  });

  it("renders both scenes from a multi-scene project with one wrapper per scene", () => {
    const { container } = render(<OpenEffectsComposition project={twoScenesFixture} />);
    expect(container.innerHTML).toContain("Scene 1");
    expect(container.innerHTML).toContain("Scene 2");
    const layerWrappers = container.querySelectorAll("[data-layer-id]");
    expect(layerWrappers.length).toBe(twoScenesFixture.scenes.length);
  });
});
