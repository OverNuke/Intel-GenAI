import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./fonts.css", import.meta.url), "utf-8");
const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf-8");
const publicDir = new URL("../../public", import.meta.url);

interface FontFace {
  family: string;
  weight: string;
  display: string;
  urls: string[];
}

function parseFaces(): FontFace[] {
  const blocks = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1] ?? "");
  return blocks.map((body) => ({
    family: /font-family:\s*["']?([^"';]+)["']?\s*;/.exec(body)?.[1]?.trim() ?? "",
    weight: /font-weight:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? "",
    display: /font-display:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? "",
    urls: [...body.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1] ?? ""),
  }));
}

const faces = parseFaces();

describe("fonts.css self-hosted faces", () => {
  it("declares at least one face", () => {
    expect(faces.length).toBeGreaterThan(0);
  });

  it("uses font-display: swap on every face", () => {
    for (const f of faces) expect(f.display, `${f.family} ${f.weight}`).toBe("swap");
  });

  it("points every url to an existing /fonts/ file", () => {
    for (const f of faces) {
      expect(f.urls.length).toBeGreaterThan(0);
      for (const url of f.urls) {
        expect(url).toMatch(/^\/fonts\/[\w.-]+\.woff2$/);
        expect(existsSync(new URL(`.${url}`, `${publicDir.href}/`)), url).toBe(true);
      }
    }
  });

  it("declares only Figtree and IBM Plex Mono, both referenced by tokens", () => {
    const families = new Set(faces.map((f) => f.family));
    expect([...families].sort()).toEqual(["Figtree", "IBM Plex Mono"]);
    expect(tokens).toMatch(/--font-ui:\s*Figtree\b/);
    expect(tokens).toMatch(/--font-mono:\s*"IBM Plex Mono"/);
  });

  it("covers the required weights", () => {
    const weights = (family: string): string[] =>
      faces
        .filter((f) => f.family === family)
        .map((f) => f.weight)
        .sort();
    expect(weights("Figtree")).toEqual(["400", "500", "600", "700"]);
    expect(weights("IBM Plex Mono")).toEqual(["400", "500"]);
  });

  it("does not bundle LT Remark", () => {
    expect(css).not.toMatch(/LT Remark/i);
  });

  it("has no color literals", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
