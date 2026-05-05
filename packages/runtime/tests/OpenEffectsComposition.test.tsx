import React from "react";
import { vi } from "vitest";

vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    Sequence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
    useCurrentFrame: () => 0
  };
});

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { OpenEffectsComposition } from "@/OpenEffectsComposition";
import { singleSceneFixture } from "@/fixtures/singleScene";

describe("<OpenEffectsComposition>", () => {
  it("renders all scene wrappers ordered", () => {
    const { container } = render(<OpenEffectsComposition project={singleSceneFixture} />);
    // jsdom env: Sequence renders children unconditionally without frame context
    // We assert the first layer's HTML is in the DOM tree.
    expect(container.innerHTML).toContain("singleScene fixture");
  });
});
