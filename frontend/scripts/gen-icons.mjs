#!/usr/bin/env node
// Generates src/ui/atoms/icon-paths.tsx from the `<symbol id="ar-*">` sprites embedded in the mock
// screens (mock/ariadna-ticketguia/prototype/screens/*.dc.html). No dependencies: run `pnpm gen:icons`.
//
// Attributes are copied generically (hyphenated ones camelCased), so a new element shape or attribute
// in the mock never silently drops geometry. A symbol id that appears in several files must have
// identical geometry or the script throws.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** @typedef {{ tag: string, attrs: [string, string][] }} IconChild */
/** @typedef {{ name: string, children: IconChild[] }} IconSymbol */

/**
 * Lucide outline icons the mock sprites do not ship as symbols (same 24x24 viewBox and stroke rules).
 * @type {IconSymbol[]}
 */
export const ADAPTED = [
  {
    name: "maximize-2",
    children: [
      { tag: "path", attrs: [["d", "M15 3h6v6"]] },
      { tag: "path", attrs: [["d", "m21 3-7 7"]] },
      { tag: "path", attrs: [["d", "m3 21 7-7"]] },
      { tag: "path", attrs: [["d", "M9 21H3v-6"]] },
    ],
  },
  {
    name: "minimize-2",
    children: [
      { tag: "path", attrs: [["d", "m14 10 7-7"]] },
      { tag: "path", attrs: [["d", "M20 10h-6V4"]] },
      { tag: "path", attrs: [["d", "m3 21 7-7"]] },
      { tag: "path", attrs: [["d", "M4 14h6v6"]] },
    ],
  },
  {
    name: "pencil",
    children: [
      {
        tag: "path",
        attrs: [
          [
            "d",
            "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
          ],
        ],
      },
      { tag: "path", attrs: [["d", "m15 5 4 4"]] },
    ],
  },
];

const SYMBOL_RE = /<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g;
const CHILD_RE = /<([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(?:\/>|>\s*<\/\1>)/g;
const ATTR_RE = /([\w:-]+)="([^"]*)"/g;

const camelCase = (attr) => attr.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

/**
 * Extracts every `<symbol id="ar-*">` from the given markup, deduped by id.
 * @param {string} html
 * @returns {IconSymbol[]}
 */
export function parseSymbols(html) {
  /** @type {Map<string, IconSymbol>} */
  const byId = new Map();
  for (const [, head, body] of html.matchAll(SYMBOL_RE)) {
    const id = /\bid="([^"]+)"/.exec(head)?.[1];
    if (!id) continue;
    const viewBox = /\bviewBox="([^"]+)"/.exec(head)?.[1];
    if (viewBox !== "0 0 24 24") throw new Error(`${id}: expected viewBox "0 0 24 24", got "${viewBox}"`);

    const rest = body.replace(CHILD_RE, "").trim();
    if (rest) throw new Error(`${id}: unsupported markup inside symbol: ${rest.slice(0, 80)}`);

    const children = [...body.matchAll(CHILD_RE)].map(([, tag, attrSource]) => ({
      tag,
      attrs: [...attrSource.matchAll(ATTR_RE)].map(([, key, value]) => [camelCase(key), value]),
    }));
    const symbol = { name: id.replace(/^ar-/, ""), children };

    const known = byId.get(id);
    if (known && JSON.stringify(known) !== JSON.stringify(symbol)) {
      throw new Error(`${id}: conflicting geometry between files`);
    }
    byId.set(id, known ?? symbol);
  }
  return [...byId.values()];
}

const renderChild = ({ tag, attrs }) =>
  `<${tag}${attrs.map(([key, value]) => ` ${key}="${value}"`).join("")} />`;

const renderEntry = ({ name, children }) =>
  [
    `  "${name}": (`,
    "    <>",
    ...children.map((child) => `      ${renderChild(child)}`),
    "    </>",
    "  ),",
  ].join("\n");

/**
 * Renders the source of `icon-paths.tsx`.
 * @param {IconSymbol[]} symbols sprite symbols, in order of appearance
 * @param {IconSymbol[]} adapted symbols emitted after the sprites with an `// adapted:` comment
 * @returns {string}
 */
export function buildModule(symbols, adapted) {
  const entries = [
    ...symbols.map(renderEntry),
    ...adapted.map(
      (symbol) =>
        `  // adapted: Lucide outline "${symbol.name}"; the mock sprites do not ship it as a symbol.\n${renderEntry(symbol)}`,
    ),
  ];
  return `/**
 * Generated file by \`pnpm gen:icons\` (frontend/scripts/gen-icons.mjs): the ${symbols.length} icon symbols
 * (\`#ar-*\`) of the sprites in \`mock/ariadna-ticketguia/prototype/screens/*.dc.html\` (Lucide outline,
 * 24x24 viewBox) followed by ${adapted.length} \`// adapted:\` Lucide icons the mock does not ship as symbols.
 * Do not hand-edit. Stroke/fill come from the \`.icon\` rule in \`components.css\`.
 */
import type { ReactElement } from "react";

export const ICONS = {
${entries.join("\n")}
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof ICONS;
`;
}

function main() {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const screens = join(root, "..", "mock", "ariadna-ticketguia", "prototype", "screens");
  const html = readdirSync(screens)
    .filter((file) => file.endsWith(".dc.html"))
    .sort()
    .map((file) => readFileSync(join(screens, file), "utf8"))
    .join("\n");
  const symbols = parseSymbols(html);
  const target = join(root, "src", "ui", "atoms", "icon-paths.tsx");
  writeFileSync(target, buildModule(symbols, ADAPTED));
  console.log(`icon-paths.tsx: ${symbols.length} sprite symbols + ${ADAPTED.length} adapted = ${symbols.length + ADAPTED.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
