// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { THEMES, applyTheme, isTheme } from "./theme";

describe("theme", () => {
  it("exposes the three themes", () => {
    expect([...THEMES]).toEqual(["grayscale", "azul", "verde"]);
  });

  it("isTheme accepts only known themes", () => {
    expect(isTheme("azul")).toBe(true);
    expect(isTheme("rosa")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("applyTheme sets data-theme for a valid value", () => {
    const root = document.createElement("html");
    root.dataset.theme = "grayscale";
    expect(applyTheme(root, "verde")).toBe("verde");
    expect(root.dataset.theme).toBe("verde");
  });

  it("applyTheme keeps the current theme when the value is invalid", () => {
    const root = document.createElement("html");
    root.dataset.theme = "azul";
    expect(applyTheme(root, "rosa")).toBe("azul");
    expect(root.dataset.theme).toBe("azul");
  });
});
