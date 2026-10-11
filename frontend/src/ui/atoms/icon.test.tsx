// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Icon } from "./icon";
import { ICONS } from "./icon-paths";

afterEach(cleanup);

describe("ICONS (generated from the mock sprite)", () => {
  it("exposes the 51 mock symbols plus 8 adapted ones by kebab-case name without the ar- prefix", () => {
    const names = Object.keys(ICONS);
    expect(names).toHaveLength(59);
    expect(new Set(names).size).toBe(59);
    expect(names).toContain("wrench");
    expect(names).toContain("circle-alert");
    expect(names).toContain("send-horizontal");
    expect(names.some((name) => name.startsWith("ar-"))).toBe(false);
  });

  it("includes the adapted icons (not in the mock sprite) and each renders an svg with data-icon", () => {
    const adapted = ["chart-column", "clock", "maximize-2", "minimize-2", "pencil", "list-checks", "chevron-up", "file-text"] as const;
    for (const name of adapted) {
      expect(Object.keys(ICONS)).toContain(name);
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector(`svg[data-icon="${name}"]`)).not.toBeNull();
      unmount();
    }
  });

  it("draws at least one shape for every icon", () => {
    for (const name of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelectorAll("path, circle, rect, line, polyline, ellipse").length).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe("Icon", () => {
  it("is a decorative 24x24 svg: aria-hidden, not focusable", () => {
    const { container } = render(<Icon name="wrench" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
    expect(svg?.getAttribute("data-icon")).toBe("wrench");
  });

  it("draws the shapes of the requested symbol", () => {
    const { container } = render(<Icon name="circle-help" />);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
    expect(container.querySelectorAll("path")).toHaveLength(2);
  });

  it("uses the md size by default and the sm size when asked", () => {
    const md = render(<Icon name="check" />).container.querySelector("svg");
    expect(md?.getAttribute("class")).toBe("icon");
    cleanup();
    const sm = render(<Icon name="check" size="sm" />).container.querySelector("svg");
    expect(sm?.getAttribute("class")).toBe("icon icon-16");
  });

  it("draws the lg size for state cards", () => {
    const lg = render(<Icon name="lock" size="lg" />).container.querySelector("svg");
    expect(lg?.getAttribute("class")).toBe("icon icon-24");
  });

  it("rejects unknown icon names at type level", () => {
    // @ts-expect-error "not-an-icon" is not part of the mock sprite
    expect(() => render(<Icon name="not-an-icon" />)).not.toThrow();
  });
});
