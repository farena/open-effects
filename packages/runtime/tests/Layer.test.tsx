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

  it("substitutes $KEY references in HTML and CSS at the current frame", () => {
    // Mock frame is 15; interpolate 0→100 over [0, 30] → expect 50
    const layer: LayerT = {
      ...baseLayer,
      html: '<div class="card">x=$POSITION_X</div>',
      css: ".card { transform: translateX($POSITION_Xpx); }",
      keyframes: [
        {
          frame: 0,
          property: "custom.POSITION_X",
          value: "0",
          easingOut: { type: "linear" },
        },
        {
          frame: 30,
          property: "custom.POSITION_X",
          value: "100",
          easingOut: { type: "linear" },
        },
      ],
    };
    const { container } = render(<Layer layer={layer} />);
    const wrapper = container.querySelector(
      '[data-layer-id="L1"]',
    ) as HTMLElement;
    expect(wrapper.innerHTML).toContain("x=50");
    const style = container.querySelector("style");
    expect(style?.textContent).toContain("translateX(50px)");
  });

  it("exposes the layer-local time as the --re-time CSS variable in seconds", () => {
    // Mock frame is 15, fps is 30, layer.startFrame is 0 → re-time = 0.5s
    const { container } = render(<Layer layer={baseLayer} />);
    const wrapper = container.querySelector(
      '[data-layer-id="L1"]',
    ) as HTMLElement;
    expect(wrapper.style.getPropertyValue("--re-time")).toBe("0.5s");
  });

  it("concatenates subtitle.presetCss BEFORE layer.css so user rules win by cascade", () => {
    const subtitleLayer: LayerT = {
      id: "L1",
      type: "subtitle",
      order: 0,
      name: "Subs",
      html: '<div class="subtitle-container"><div class="subtitle-segment">hi</div></div>',
      css: ".subtitle-container { color: blue; }",
      startFrame: 0,
      endFrame: 30,
      visible: true,
      keyframes: [],
      subtitle: {
        linkedAudioTrackId: "t1",
        transcript: { segments: [] },
        presetKey: "subtitle-fade",
        manualOverride: false,
        presetCss: ".subtitle-container { color: black; font-size: 32px; }",
      },
    };
    const { container } = render(<Layer layer={subtitleLayer} />);
    const styleText = container.querySelector("style")?.textContent ?? "";
    // Both the preset and the user rules made it into the scoped stylesheet
    expect(styleText).toContain("font-size: 32px");
    expect(styleText).toContain("color: blue");
    // Preset declaration appears before user CSS so user's color wins by order
    const presetIdx = styleText.indexOf("color: black");
    const userIdx = styleText.indexOf("color: blue");
    expect(presetIdx).toBeGreaterThanOrEqual(0);
    expect(userIdx).toBeGreaterThan(presetIdx);
  });

  it("subtracts layer.startFrame from the frame for --re-time", () => {
    // Mock frame is 15, layer.startFrame is 5, fps is 30 → re-time = (15-5)/30 = 0.3333...s
    const layer = { ...baseLayer, startFrame: 5, endFrame: 30 };
    const { container } = render(<Layer layer={layer} />);
    const wrapper = container.querySelector(
      '[data-layer-id="L1"]',
    ) as HTMLElement;
    const value = wrapper.style.getPropertyValue("--re-time");
    expect(value).toMatch(/^0\.3333/);
  });

  it("leaves $KEY unsubstituted when no matching custom keyframe exists", () => {
    const layer: LayerT = {
      ...baseLayer,
      html: '<div class="card">$MISSING here</div>',
      css: "",
      keyframes: [],
    };
    const { container } = render(<Layer layer={layer} />);
    const wrapper = container.querySelector(
      '[data-layer-id="L1"]',
    ) as HTMLElement;
    expect(wrapper.innerHTML).toContain("$MISSING here");
  });
});
