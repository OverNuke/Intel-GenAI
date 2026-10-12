import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ADAPTED, buildModule, parseSymbols } from "../../../scripts/gen-icons.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCREENS = join(here, "../../../../mock/ariadna-ticketguia/prototype/screens");
const GENERATED = join(here, "icon-paths.tsx");

const symbol = (id: string, body: string) => `<symbol id="${id}" viewBox="0 0 24 24">${body}</symbol>`;

describe("parseSymbols", () => {
  it("copies every attribute of every child generically, in source order, dropping the ar- prefix", () => {
    const html = symbol(
      "ar-box",
      '<rect width="20" height="14" x="2" y="3" rx="2" ry="1"></rect><circle cx="12" cy="12" r=".5" fill="currentColor"></circle><line x1="8" x2="16" y1="21" y2="21"></line>',
    );
    expect(parseSymbols(html)).toEqual([
      {
        name: "box",
        children: [
          {
            tag: "rect",
            attrs: [
              ["width", "20"],
              ["height", "14"],
              ["x", "2"],
              ["y", "3"],
              ["rx", "2"],
              ["ry", "1"],
            ],
          },
          {
            tag: "circle",
            attrs: [
              ["cx", "12"],
              ["cy", "12"],
              ["r", ".5"],
              ["fill", "currentColor"],
            ],
          },
          {
            tag: "line",
            attrs: [
              ["x1", "8"],
              ["x2", "16"],
              ["y1", "21"],
              ["y2", "21"],
            ],
          },
        ],
      },
    ]);
  });

  it("camelCases hyphenated attributes so they are valid JSX props", () => {
    const html = symbol("ar-soft", '<path d="M0 0h1" stroke-width="1.5" stroke-linecap="round"></path>');
    expect(parseSymbols(html)[0]?.children[0]?.attrs).toEqual([
      ["d", "M0 0h1"],
      ["strokeWidth", "1.5"],
      ["strokeLinecap", "round"],
    ]);
  });

  it("keeps one entry per id when the same symbol appears in several files", () => {
    const one = symbol("ar-dup", '<path d="M1 1"></path>');
    const names = parseSymbols(`${one}\n${symbol("ar-other", '<path d="M2 2"></path>')}\n${one}`).map((s) => s.name);
    expect(names).toEqual(["dup", "other"]);
  });

  it("throws when one id has conflicting geometry", () => {
    const html = `${symbol("ar-clash", '<path d="M1 1"></path>')}${symbol("ar-clash", '<path d="M9 9"></path>')}`;
    expect(() => parseSymbols(html)).toThrow(/ar-clash/);
  });
});

describe("buildModule", () => {
  it("emits one JSX entry per symbol, with every attribute, and `// adapted:` comments for adapted ones", () => {
    const symbols = parseSymbols(symbol("ar-ruler", '<line x1="8" x2="16" y1="21" y2="21"></line>'));
    const adapted: Parameters<typeof buildModule>[1] = [
      { name: "pencil", children: [{ tag: "path", attrs: [["d", "m15 5 4 4"]] }] },
    ];
    const source = buildModule(symbols, adapted);
    expect(source).toContain('"ruler": (');
    expect(source).toContain('<line x1="8" x2="16" y1="21" y2="21" />');
    expect(source).toMatch(/\/\/ adapted:[^\n]*\n\s*"pencil": \(/);
    expect(source).toContain('<path d="m15 5 4 4" />');
    expect(source).toContain("satisfies Record<string, ReactElement>");
    expect(source).toContain("export type IconName = keyof typeof ICONS;");
  });
});

// `mock/` is gitignored: skip the sync check on a fresh clone / CI that does not have it.
describe.skipIf(!existsSync(SCREENS))("icon-paths.tsx is generated, not hand-edited", () => {
  it("equals buildModule(parseSymbols(mock screens), ADAPTED)", () => {
    const html = readdirSync(SCREENS)
      .filter((file) => file.endsWith(".dc.html"))
      .sort()
      .map((file) => readFileSync(join(SCREENS, file), "utf8"))
      .join("\n");
    const expected = buildModule(parseSymbols(html), ADAPTED);
    const actual = readFileSync(GENERATED, "utf8").replace(/\r\n/g, "\n");
    expect(actual).toBe(expected);
  });
});
