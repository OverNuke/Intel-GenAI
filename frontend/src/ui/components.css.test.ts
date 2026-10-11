import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./components.css", import.meta.url), "utf-8");
const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf-8");

/** Custom properties that components.css sets locally (scoped to a rule), not design tokens. */
const LOCAL_PROPS = new Set(["--tint", "--ink", "--fill", "--nav-h"]);

function hasSelector(selector: string): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s,{}])${escaped}(?![\\w-])`, "m").test(css);
}

describe("components.css primitives (REQ-VF-2)", () => {
  it("defines every shared primitive", () => {
    const required = [
      ".pill",
      ".tone-info",
      ".tone-neutral",
      ".tone-warning",
      ".tone-success",
      ".tone-error",
      ".stepper",
      ".stepper--full",
      ".stepper--vertical",
      ".step",
      ".step-node",
      ".step-flag",
      ".rec-head",
      ".rail-rows",
      ".rail-row",
      ".alert",
      ".crumb",
      ".icon-btn",
      ".opt-group",
      ".opt-tile",
      ".field-head",
      ".assist-tag",
      ".todo-tag",
      ".input-wrap",
      ".composer",
      ".msg-who",
      ".form-panel",
      ".sec-head",
      ".sr",
      ".icon",
      ".icon-16",
      ".is-inactive",
      ".rail-item",
      ".rail-label",
      ".table-scroll",
      "[data-tooltip]",
    ];
    const missing = required.filter((selector) => !hasSelector(selector));
    expect(missing).toEqual([]);
  });

  it("uses only token colours: no hex or rgb literals", () => {
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(css.match(/rgba?\(/g) ?? []).toEqual([]);
  });

  it("references only custom properties defined in tokens.css or set locally", () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string));
    const defined = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1] as string));
    const unknown = [...used].filter((name) => !defined.has(name) && !LOCAL_PROPS.has(name));
    expect(used.size).toBeGreaterThan(20);
    expect(unknown).toEqual([]);
  });

  it("applies .is-inactive only inside the compact media query", () => {
    const outside = css.replace(/@media \(max-width: 767px\) \{[\s\S]*?\n\}\n/g, "");
    expect(outside).not.toMatch(/\.is-inactive/);
    const compact = [...css.matchAll(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}\n/g)].map((m) => m[1]).join("\n");
    expect(compact).toMatch(/\.is-inactive\s*\{\s*display:\s*none/);
  });

  it("keeps interactive primitives at the 44px control size with a visible focus ring", () => {
    expect(css).toMatch(/\.icon-btn\s*\{[^}]*width:\s*var\(--size-control\)[^}]*height:\s*var\(--size-control\)/);
    expect(css).toMatch(/\.opt-tile\s*\{[^}]*min-height:\s*var\(--size-control\)/);
    expect(css).toMatch(/\.opt-tile:has\(input:focus-visible\)/);
  });

  it("navigation rail: sticky full-height, labelled >=1101px, icon-only <=1100px with a tooltip (REQ-NS-2/3)", () => {
    expect(css).toMatch(/\.rail\s*\{[^}]*position:\s*sticky[^}]*height:\s*var\(--size-viewport\)/);
    expect(css).toMatch(/\.app\s*\{[^}]*grid-template-columns:\s*calc\(var\(--size-rail\) \* 3\) minmax\(0, 1fr\)/);
    expect(css).toMatch(/\[data-tooltip\]::after\s*\{[^}]*content:\s*attr\(data-tooltip\)/);
    expect(css).toMatch(/@media \(min-width: 1101px\) \{[\s\S]*?\[data-tooltip\]::after[\s\S]*?display:\s*none/);
  });

  it("1100px block (= --bp-medium) hides rail labels visually and adapts the wide grids (S-NS-6, S-RL-2)", () => {
    const blocks = [...css.matchAll(/@media \(max-width: 1100px\) \{([\s\S]*?)\n\}\n/g)].map((m) => m[1] as string);
    expect(blocks.length).toBeGreaterThan(0);
    const medium = blocks.join("\n");
    expect(medium).toMatch(/\.rail-label/);
    expect(medium).toMatch(/\.conversation-grid/);
    expect(medium).toMatch(/\.rec-head/);
    expect(medium).toMatch(/\.opt-group/);
    expect(medium).not.toMatch(/\.is-inactive/);
  });

  it("does not impose a 420px minimum on the conversation grid (REQ-RL-3)", () => {
    const grid = /\.conversation-grid\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(grid).toMatch(/grid-template-columns/);
    expect(grid).not.toMatch(/minmax\(420px/);
    expect(grid).not.toMatch(/--size-chat-min/);
  });

  it("scrolls wide tables inside a .table-scroll region, not the page (REQ-RL-2)", () => {
    expect(css).toMatch(/\.table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  });

  describe("mobile bottom tab bar (REQ-NS-M1..M8)", () => {
    const compactBlocks = [...css.matchAll(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}\n/g)];
    const bar = compactBlocks.find((m) => /\.app \.nav-sections\s*\{/.test(m[1] as string));
    const barCss = (bar?.[1] as string | undefined) ?? "";

    it("has a 767px block that fixes .nav-sections to the bottom with the safe-area inset", () => {
      expect(bar).toBeDefined();
      const rule = /\.app \.nav-sections\s*\{([^}]*)\}/.exec(barCss)?.[1] ?? "";
      expect(rule).toMatch(/position:\s*fixed/);
      expect(rule).toMatch(/bottom:\s*0/);
      expect(rule).toMatch(/env\(safe-area-inset-bottom\)/);
      expect(rule).toMatch(/z-index:\s*var\(--z-island\)/);
    });

    it("un-hides the labels, hides the aux text with the clip recipe and pads .app-main by --nav-h", () => {
      expect(barCss).toMatch(/\.app \.nav-sections \.rail-label\s*\{[^}]*position:\s*static[^}]*clip-path:\s*none/);
      expect(barCss).toMatch(/\.app \.nav-sections \.t-meta\s*\{[^}]*clip-path:\s*inset\(50%\)/);
      expect(barCss).toMatch(/\.app-main\s*\{[^}]*padding-bottom:[^;}]*var\(--nav-h\)/);
      expect(barCss).toMatch(/--nav-h:\s*calc\(var\(--size-island-rail\) \+ env\(safe-area-inset-bottom\)\)/);
    });

    it("never hides the Secciones nav with display:none at any width", () => {
      const all = compactBlocks.map((m) => m[1]).join("\n");
      const rules = [...all.matchAll(/([^{}]+)\{([^}]*)\}/g)];
      // only the nav container itself (selector ends in it); the tooltip ::after may be switched off
      const hiding = rules.filter(
        ([, selector, body]) =>
          /display:\s*none/.test(body as string) && /(\.nav-sections|\.rail|\.islands)(?![\w-])\s*$/.test((selector as string).trim()),
      );
      expect(rules.length).toBeGreaterThan(0);
      expect(hiding.map((m) => (m[1] as string).trim())).toEqual([]);
      expect(css).not.toMatch(/\.nav-sections\s*\{[^}]*display:\s*none/);
    });

    it("comes after the 1100px block so the compact rules win the cascade", () => {
      const medium = css.search(/@media \(max-width: 1100px\) \{/);
      const compact = css.indexOf(".app .nav-sections {");
      expect(medium).toBeGreaterThan(-1);
      expect(compact).toBeGreaterThan(medium);
    });

    it("keeps the removed horizontal-strip layout out of the shell (no row-direction rail)", () => {
      expect(barCss).not.toMatch(/flex-direction:\s*row;[^}]*\.rail\b/);
      expect(css).not.toMatch(/grid-template-areas:\s*"top"\s*"rail"\s*"main"/);
    });
  });
});
