import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./components.css", import.meta.url), "utf-8");
const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf-8");

/** Custom properties that components.css sets locally (scoped to a rule), not design tokens. */
const LOCAL_PROPS = new Set(["--tint", "--ink", "--fill"]);

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
});
