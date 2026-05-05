import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Layer } from "@/components/Layer";
import type { Layer as LayerT } from "@open-effects/shared-types";

const baseLayer: LayerT = {
  id: "L1", order: 0, name: "test",
  html: '<div class="card">hello</div>',
  css: ".card { color: red; }",
  startFrame: 0, endFrame: 30, keyframes: []
};

describe("<Layer>", () => {
  it("renders sanitized HTML inside isolated container", () => {
    const { container } = render(<Layer layer={baseLayer} />);
    const wrapper = container.querySelector('[data-layer-id="L1"]');
    expect(wrapper).toBeTruthy();
    expect(wrapper!.innerHTML).toContain('<div class="card">hello</div>');
  });
  it("strips <script> from HTML", () => {
    const layer = { ...baseLayer, html: '<div>ok</div><script>alert(1)</script>' };
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
    const wrapper = container.querySelector('[data-layer-id="L1"]') as HTMLElement;
    expect(wrapper.style.contain).toBe("strict");
  });
});
