import { describe, it, expect, vi } from "vitest";

vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return {
    ...actual,
    useCurrentFrame: () => 15,
    useVideoConfig: () => ({
      fps: 30,
      durationInFrames: 30,
      width: 1920,
      height: 1080,
    }),
  };
});

import { render } from "@testing-library/react";
import { Layer } from "@/components/Layer";
import type { Layer as LayerT } from "@open-effects/shared-types";

const baseLayer: LayerT = {
  id: "L1",
  order: 0,
  name: "test",
  html: '<div class="card">hello</div>',
  css: ".card { color: red; }",
  startFrame: 0,
  endFrame: 30,
  visible: true,
  keyframes: [],
};

describe("<Layer>", () => {
  it("renders sanitized HTML inside isolated container", () => {
    const { container } = render(<Layer layer={baseLayer} />);
    const wrapper = container.querySelector('[data-layer-id="L1"]');
    expect(wrapper).toBeTruthy();
    expect(wrapper!.innerHTML).toContain('<div class="card">hello</div>');
  });
  it("strips <script> from HTML", () => {
    const layer = {
      ...baseLayer,
      html: "<div>ok</div><script>alert(1)</script>",
    };
    const { container } = render(<Layer layer={layer} />);
    expect(container.innerHTML).not.toMatch(/<script/i);
  });
  it("injects scoped CSS prefixed by layer id", () => {
    const { container } = render(<Layer layer={baseLayer} />);
    const style = container.querySelector("style");
    expect(style?.textContent).toContain('[data-layer-id="L1"] .card');
  });
  it("applies contain: strict to wrapper", () => {
    const { container } = render(<Layer layer={baseLayer} />);
    const wrapper = container.querySelector(
      '[data-layer-id="L1"]',
    ) as HTMLElement;
    expect(wrapper.style.contain).toBe("strict");
  });
  it("merges computed inline style from keyframes", () => {
    const layer: LayerT = {
      ...baseLayer,
      keyframes: [
        {
          frame: 0,
          property: "opacity",
          value: "0",
          easingOut: { type: "linear" },
        },
        {
          frame: 30,
          property: "opacity",
          value: "1",
          easingOut: { type: "linear" },
        },
      ],
    };
    const { container } = render(<Layer layer={layer} />);
    const wrapper = container.querySelector(
      '[data-layer-id="L1"]',
    ) as HTMLElement;
    expect(parseFloat(wrapper.style.opacity)).toBeCloseTo(0.5, 1);
  });

  it("renders nothing when layer.visible is false", () => {
    const layer = { ...baseLayer, visible: false };
    const { container } = render(<Layer layer={layer} />);
    expect(container.querySelector('[data-layer-id="L1"]')).toBeNull();
  });

  it("renders nothing before startFrame", () => {
    const layer = { ...baseLayer, startFrame: 20, endFrame: 30 };
    const { container } = render(<Layer layer={layer} />);
    expect(container.querySelector('[data-layer-id="L1"]')).toBeNull();
  });

  it("renders nothing at or after endFrame (end exclusive)", () => {
    const layer = { ...baseLayer, startFrame: 0, endFrame: 15 };
    const { container } = render(<Layer layer={layer} />);
    expect(container.querySelector('[data-layer-id="L1"]')).toBeNull();
  });
});
