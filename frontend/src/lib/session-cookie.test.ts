import { describe, expect, it } from "vitest";
import { hasSessionCookie, unauthenticatedHref } from "./session-cookie";

describe("unauthenticatedHref", () => {
  it("sends a stale session to /sesion-expirada and a first visit to /entrar", () => {
    expect(unauthenticatedHref("ariadna_session=abc")).toBe("/sesion-expirada");
    expect(unauthenticatedHref(null)).toBe("/entrar");
    expect(unauthenticatedHref("theme=dark")).toBe("/entrar");
  });
});

describe("hasSessionCookie", () => {
  it.each([
    [null, false],
    ["", false],
    ["theme=dark", false],
    ["xariadna_session=abc", false],
    ["ariadna_session_old=abc", false],
    ["ariadna_session=abc", true],
    ["theme=dark; ariadna_session=abc; lang=es", true],
    ["theme=dark;ariadna_session=abc", true],
    ["ariadna_session=", false],
  ])("%j -> %s", (header, expected) => {
    expect(hasSessionCookie(header)).toBe(expected);
  });
});
