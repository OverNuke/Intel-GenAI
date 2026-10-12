// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AriadnaMark } from "./ariadna-mark";

afterEach(cleanup);

describe("AriadnaMark", () => {
  it("is a decorative inline svg: hidden from assistive tech and not an img role", () => {
    const { container } = render(<AriadnaMark />);
    const svg = container.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.getAttribute("role")).toBeNull();
    expect(svg.classList.contains("ariadna-mark")).toBe(true);
  });

  it("is not an icon-set glyph, so the 24px icon rule does not apply to it", () => {
    const { container } = render(<AriadnaMark />);
    expect(container.querySelector("svg[data-icon]")).toBeNull();
  });

  it("takes its colour from the surrounding text, not a hard-coded value", () => {
    const { container } = render(<AriadnaMark />);
    const svg = container.querySelector("svg")!;
    expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}|rgb\(/i);
    expect(svg.querySelector("path")?.getAttribute("stroke")).toBe("currentColor");
  });
});
