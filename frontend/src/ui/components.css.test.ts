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

  describe("U6 split layout (REQ-AC-S1..S3, REQ-TS-S1)", () => {
    it("defines the page, side column, swappable panel and chat shell selectors", () => {
      for (const selector of [".conv-page", ".conv-side", ".conv-panel", ".conv-actions", ".conversation"]) {
        expect(hasSelector(selector), selector).toBe(true);
      }
    });

    it("splits the grid into a bounded summary column and a fluid chat column", () => {
      const grid = /\.conversation-grid\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
      expect(grid).toMatch(/grid-template-columns:\s*minmax\(320px, 440px\) minmax\(0, 1fr\)/);
      expect(grid).not.toMatch(/--size-chat-min/);
    });

    it("lets the hidden attribute win over the panel display and keeps the form out of the layout", () => {
      expect(css).toMatch(/\.conv-panel\[hidden\]\s*\{[^}]*display:\s*none/);
    });

    it("styles the chat shell as a hairline surface with --radius-xl whose thread scrolls and composer stays pinned", () => {
      const shell = /(^|\n)\.conversation\s*\{([^}]*)\}/.exec(css)?.[2] ?? "";
      expect(shell).toMatch(/border:\s*var\(--border-hairline\) solid var\(--color-hairline\)/);
      expect(shell).toMatch(/border-radius:\s*var\(--radius-xl\)/);
      expect(shell).toMatch(/grid-template-rows:\s*minmax\(0, 1fr\) auto auto/);
      const thread = /\.chat-thread\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
      expect(thread).toMatch(/min-height:\s*0/);
      expect(thread).toMatch(/overflow-y:\s*auto/);
      expect(thread).not.toMatch(/max-height/);
      expect(thread).toMatch(/padding:\s*var\(--space-5\)/);
    });

    it("gives a disabled .btn a visibly distinct, tokens-only look (S-TS-S4)", () => {
      const rule = /\.btn:disabled[^{]*\{([^}]*)\}/.exec(css)?.[1] ?? "";
      expect(rule).toMatch(/opacity:/);
      expect(rule).toMatch(/cursor:\s*not-allowed/);
      expect(rule).not.toMatch(/#|rgb/);
    });

    it("collapses to one column at 1100px with a bounded chat height, and subtracts the bottom bar at 767px", () => {
      const medium = [...css.matchAll(/@media \(max-width: 1100px\) \{([\s\S]*?)\n\}\n/g)].map((m) => m[1]).join("\n");
      expect(medium).toMatch(/\.conv-page\s*\{[^}]*height:\s*auto/);
      expect(medium).toMatch(/\.conversation\s*\{[^}]*height:\s*max\(var\(--size-chat-min\), 60dvh\)/);
      const compact = [...css.matchAll(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}\n/g)].map((m) => m[1]).join("\n");
      expect(compact).toMatch(
        /\.conversation\s*\{[^}]*height:\s*max\(var\(--size-chat-min\), calc\(var\(--size-viewport\) - var\(--nav-h\) - var\(--space-4\) \* 2\)\)/,
      );
    });
  });

  describe("motion (REQ-MO-1..5)", () => {
    const withoutReducedMotion = css.replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/, "");
    const motion = [...withoutReducedMotion.matchAll(/(?:^|[;{\s])(transition|animation)\s*:\s*([^;]+);/g)].map(
      (m) => ({ prop: m[1] as string, value: (m[2] as string).trim() }),
    );

    it("keeps a reduced-motion block and defines the tg-fade and tg-draw keyframes", () => {
      expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?animation-duration:[\s\S]*?transition-duration:/);
      expect(css).toMatch(/@keyframes tg-fade\s*\{/);
      expect(css).toMatch(/@keyframes tg-draw\s*\{/);
    });

    it("collapses pseudo-element motion and delays under reduced motion", () => {
      const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}\n/);
      expect(block).not.toBeNull();
      const body = (block as RegExpMatchArray)[1] as string;
      const selectors = (body.match(/([^{}]+)\{/) as RegExpMatchArray)[1] as string;
      const list = selectors.split(",").map((s) => s.trim());
      expect(list).toEqual(expect.arrayContaining(["*", "*::before", "*::after"]));
      expect(body).toMatch(/animation-delay:\s*0s\s*!important/);
      expect(body).toMatch(/transition-delay:\s*0s\s*!important/);
    });

    it("uses only duration and easing tokens: no raw ms/s literals outside the reduced-motion block", () => {
      expect(withoutReducedMotion).not.toMatch(/\b\d*\.?\d+m?s\b/);
      expect(motion.length).toBeGreaterThan(8);
      for (const { value } of motion) {
        // every comma-separated transition item and every animation names a duration and an easing token
        for (const part of value.split(/,(?![^(]*\))/)) {
          expect(part).toMatch(/var\(--duration-[\w-]+\)/);
          expect(part).toMatch(/var\(--easing-[\w-]+\)/);
        }
      }
    });

    it("transitions hover/focus on buttons, icon buttons, rail items, option tiles, inputs, menu items and ticket rows (REQ-MO-1)", () => {
      for (const selector of [".btn", ".icon-btn", ".rail-item", ".opt-tile", ".input", ".menu-item", ".ticket-row-link"]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        expect(css, selector).toMatch(new RegExp(`(^|\\n)${escaped}\\s*\\{[^}]*transition:`));
      }
    });

    it("fades new messages, menus, panels and tooltips in; draws the option check; fills the stepper connector (REQ-MO-2)", () => {
      expect(css).toMatch(/\.msg\.is-new\s*\{[^}]*animation:\s*tg-fade var\(--duration-micro\)/);
      expect(css).toMatch(/\.menu\s*\{[^}]*animation:\s*tg-fade/);
      expect(css).toMatch(/\.conv-panel\s*\{[^}]*animation:\s*tg-fade/);
      expect(css).toMatch(/\.opt-check \.icon\s*\{[^}]*animation:\s*tg-draw/);
      expect(css).toMatch(/\.step::before\s*\{[^}]*transition:/);
      expect(css).toMatch(
        /\[data-tooltip\]:hover::after,\s*\[data-tooltip\]:focus-visible::after\s*\{[^}]*animation:\s*tg-fade[^;]*var\(--duration-intent\)/,
      );
    });
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

  describe("U6 islands (REQ-NS-5, S-NS-6)", () => {
    const base = /(?:^|\n)\.islands\s*\{([^}]*)\}/.exec(css);
    const baseCss = base?.[1] ?? "";
    const barCss =
      [...css.matchAll(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}\n/g)]
        .map((m) => m[1] as string)
        .find((block) => /\.app \.nav-sections\s*\{/.test(block)) ?? "";

    it("styles .islands as a sticky floating pill sized by --size-island-rail with --radius-full", () => {
      expect(base).not.toBeNull();
      expect(baseCss).toMatch(/position:\s*sticky/);
      expect(baseCss).toMatch(/width:\s*var\(--size-island-rail\)/);
      expect(baseCss).toMatch(/border-radius:\s*var\(--radius-full\)/);
      expect(baseCss).toMatch(/z-index:\s*var\(--z-island\)/);
      expect(baseCss).not.toMatch(/display:\s*none/);
    });

    it("collapses the grid for the chat root: 0 + 1fr, topbar over the islands and main", () => {
      const rule = /(?:^|\n)\.app\.is-chat\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
      expect(rule).toMatch(/grid-template-columns:\s*0\s+minmax\(0,\s*1fr\)/);
      expect(rule).toMatch(/"top top"/);
      expect(rule).toMatch(/"isl main"/);
      expect(baseCss).toMatch(/grid-area:\s*isl/);
    });

    it("keeps the labels in the accessibility tree (clip recipe) and the tooltip on at every width", () => {
      expect(css).toMatch(/\.islands \.rail-label[^{]*\{[^}]*clip-path:\s*inset\(50%\)/);
      expect(css).toMatch(/\.islands \[data-tooltip\]:hover::after[^{]*\{[^}]*display:\s*block/);
    });

    it("declares the .islands base rules ABOVE the 767px bottom bar, with lower specificity (single class)", () => {
      const baseAt = css.search(/(?:^|\n)\.islands\s*\{/);
      const barAt = css.indexOf(".app .nav-sections {");
      expect(baseAt).toBeGreaterThan(-1);
      expect(barAt).toBeGreaterThan(baseAt);
    });

    it("resets the pill and the chat grid inside the 767px bar block, never hiding it", () => {
      expect(barCss).toMatch(/\.app\.is-chat\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
      expect(barCss).toMatch(/\.app \.islands\s*\{[^}]*margin:\s*0/);
      expect(barCss).toMatch(/\.app\.is-chat \.app-main\s*\{[^}]*padding-left:\s*var\(--space-5\)/);
      expect(barCss).not.toMatch(/\.islands[^{]*\{[^}]*display:\s*none/);
    });
  });

  describe("U3 detail body (REQ-UT-S1/S2)", () => {
    it("sizes .rec-body--detail as 1fr + --size-record-rail, declared before the 767px collapse", () => {
      const rule = /(?:^|\n)\.rec-body--detail\s*\{([^}]*)\}/.exec(css);
      expect(rule?.[1]).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+var\(--size-record-rail\)/);
      const baseAt = css.search(/(?:^|\n)\.rec-body--detail\s*\{/);
      const collapseAt = css.search(/@media \(max-width: 767px\) \{\s*\.rec-body,\s*\.rec-body--detail\s*\{/);
      expect(collapseAt).toBeGreaterThan(baseAt);
      const compact = [...css.matchAll(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}\n/g)].map((m) => m[1]).join("\n");
      expect(compact).toMatch(/\.rec-body--detail\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
    });

    it("styles .ar-const / .ar-const-part only under .rec-body--detail (T2 and U7 keep the plain card)", () => {
      const selectors = [...css.matchAll(/(?:^|\n)([^@}\n][^{\n]*)\{/g)].map((m) => m[1] as string);
      const hits = selectors.filter((s) => /\.ar-const/.test(s));
      expect(hits.length).toBeGreaterThan(0);
      for (const s of hits) {
        for (const part of s.split(",")) expect(part.trim()).toMatch(/^\.rec-body--detail\s/);
      }
    });
  });
});
