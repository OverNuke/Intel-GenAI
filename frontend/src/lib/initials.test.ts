import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letter of the first two words, uppercase", () => {
    expect(initialsOf("Ana Ruiz")).toBe("AR");
    expect(initialsOf("luis herrera gómez")).toBe("LH");
  });

  it("uses one letter for a single word and ignores extra whitespace", () => {
    expect(initialsOf("Sara")).toBe("S");
    expect(initialsOf("  Ana   Ruiz ")).toBe("AR");
  });

  it("returns an empty string for a blank name", () => {
    expect(initialsOf("   ")).toBe("");
  });
});
