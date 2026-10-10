// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// No next/headers, guard or server-context mocks on purpose: if the page did a session lookup this would throw.
import NotFound, { metadata } from "./not-found";

afterEach(cleanup);

describe("app/not-found", () => {
  it("renders without a session lookup or backend", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Página no encontrada" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver al inicio" }).getAttribute("href")).toBe("/");
  });

  it("sets the document title", () => {
    expect(metadata.title).toBe("Página no encontrada — Ariadna");
  });
});
