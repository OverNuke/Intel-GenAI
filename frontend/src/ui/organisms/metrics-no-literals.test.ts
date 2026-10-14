import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** S4.6: user-facing Spanish lives in COPY (lib/copy.ts), never inline in the metrics components. */
const FILES = [
  "src/ui/molecules/stat-tile.tsx",
  "src/ui/molecules/empty-state.tsx",
  "src/ui/organisms/measured-block.tsx",
  "src/ui/organisms/estimated-block.tsx",
  "src/ui/organisms/trend-chart.tsx",
  "src/ui/organisms/trend-table.tsx",
  "src/ui/organisms/period-switch.tsx",
  "src/ui/organisms/agent-metrics-container.tsx",
  "src/app/supervisor/agente/loading.tsx",
];

const code = (file: string) =>
  readFileSync(join(process.cwd(), file), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^import .*$/gm, "");

/** Bare text between an opening tag and the next tag (expressions are `{...}` and never match). */
const jsxText = (source: string) =>
  [...source.matchAll(/(?<![\w$])<[A-Za-z][\w.]*(?:\s[^<>]*?)?>([^<>{}]*[A-Za-z][^<>{}]*)</g)].map((m) => m[1]!.trim());

describe("metrics components carry no Spanish literals (S4.6)", () => {
  it.each(FILES)("%s", (file) => {
    const source = code(file);
    expect(source.match(/[áéíóúüñÁÉÍÓÚÑ¿¡]/g) ?? []).toEqual([]);
    expect(jsxText(source)).toEqual([]);
  });

  it("the guard itself detects an inline literal", () => {
    expect(jsxText("<p>Mostrando datos</p>")).toEqual(["Mostrando datos"]);
    expect(jsxText("<p>{COPY.x}</p>")).toEqual([]);
    expect(jsxText("<p className=\"a b\">{COPY.x} </p>")).toEqual([]);
  });
});
