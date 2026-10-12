// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Icon, type IconName } from "./icon";
import { ICONS } from "./icon-paths";

afterEach(cleanup);

const REQUIRED: Record<string, string[]> = {
  line: ["x1", "y1", "x2", "y2"],
  circle: ["cx", "cy", "r"],
  rect: ["width", "height"],
  path: ["d"],
  polyline: ["points"],
};

const NAMES = Object.keys(ICONS) as IconName[];

function shapes(name: IconName) {
  const { container, unmount } = render(<Icon name={name} />);
  const children = Array.from(container.querySelectorAll("svg > *"));
  const snapshot = children.map((el) => ({
    tag: el.tagName.toLowerCase(),
    attrs: Object.fromEntries(Array.from(el.attributes).map((a) => [a.name, a.value])),
  }));
  unmount();
  return snapshot;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry) ? [full] : [];
  });
}

describe("ICONS (generated from the mock sprites)", () => {
  it("exposes 73 unique names: 70 sprite symbols plus 3 adapted ones, without the ar- prefix", () => {
    expect(NAMES).toHaveLength(73);
    expect(new Set(NAMES).size).toBe(73);
    expect(NAMES.some((name) => name.startsWith("ar-"))).toBe(false);
  });

  it("gives every child element of every icon its required geometry (no empty <line />)", () => {
    for (const name of NAMES) {
      const children = shapes(name);
      expect(children.length, `${name} draws something`).toBeGreaterThan(0);
      for (const child of children) {
        const required = REQUIRED[child.tag];
        expect(required, `${name}: unexpected <${child.tag}>`).toBeDefined();
        for (const attr of required ?? []) {
          expect(child.attrs[attr], `${name} <${child.tag}> ${attr}`).toBeTruthy();
        }
      }
    }
  });

  it("circle-alert draws the circle, the vertical bar and the dot", () => {
    expect(shapes("circle-alert")).toEqual([
      { tag: "circle", attrs: { cx: "12", cy: "12", r: "10" } },
      { tag: "line", attrs: { x1: "12", x2: "12", y1: "8", y2: "12" } },
      { tag: "line", attrs: { x1: "12", x2: "12.01", y1: "16", y2: "16" } },
    ]);
  });

  it("monitor draws the screen rect and the two stand lines", () => {
    expect(shapes("monitor")).toEqual([
      { tag: "rect", attrs: { width: "20", height: "14", x: "2", y: "3", rx: "2" } },
      { tag: "line", attrs: { x1: "8", x2: "16", y1: "21", y2: "21" } },
      { tag: "line", attrs: { x1: "12", x2: "12", y1: "17", y2: "21" } },
    ]);
  });

  it("includes the names the access screens, T4 and U7 need, plus the adapted ones", () => {
    const required = [
      "building-2",
      "mail",
      "lock",
      "eye",
      "eye-off",
      "arrow-left",
      "info",
      "circle-alert",
      "circle-check",
      "clock",
      "list-checks",
      "maximize-2",
      "minimize-2",
      "pencil",
    ];
    for (const name of required) expect(NAMES).toContain(name);
  });

  it("every literal <Icon name=\"...\"> in src is registered", () => {
    const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const used = new Set<string>();
    for (const file of sourceFiles(srcRoot)) {
      for (const match of readFileSync(file, "utf8").matchAll(/<Icon\s+name="([^"]+)"/g)) used.add(match[1] ?? "");
    }
    expect(used.size).toBeGreaterThan(10);
    for (const name of used) expect(NAMES, `unregistered icon "${name}"`).toContain(name);
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

  it("rejects a 32px size at type level and clamps it to the default size at runtime", () => {
    // @ts-expect-error only "sm" | "md" | "lg" (16 | 20 | 24 px) exist
    const { container } = render(<Icon name="check" size="xl" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toBe("icon");
  });

  it("renders nothing for an unknown icon name instead of crashing", () => {
    // @ts-expect-error "not-an-icon" is not part of the registry
    const { container } = render(<Icon name="not-an-icon" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
