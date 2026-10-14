// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComingSoon } from "./coming-soon";

afterEach(cleanup);

describe("ComingSoon", () => {
  it("renders the shared page header with one h1 and the next-stage line", () => {
    const { container } = render(<ComingSoon title="Registro" />);
    expect(container.querySelectorAll("header.page-header h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Registro" })).toBeTruthy();
    expect(container.querySelector(".page-header__back")).toBeNull();
    expect(screen.getByText("Próxima etapa del prototipo")).toBeTruthy();
  });
});
