// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

afterEach(cleanup);

describe("PageHeader", () => {
  it("renders exactly one focusable h1, with an optional id", () => {
    const { container } = render(<PageHeader title="Mis tickets" titleId="view-title" />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Mis tickets" });
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(h1.getAttribute("tabindex")).toBe("-1");
    expect(h1.id).toBe("view-title");
  });

  it("renders the back control as an icon-only link named by its label", () => {
    render(<PageHeader title="T" back={{ href: "/inicio", label: "Volver" }} />);
    const link = screen.getByRole("link", { name: "Volver" });
    expect(link.getAttribute("href")).toBe("/inicio");
    expect(link.className).toContain("icon-btn");
    expect(link.querySelector('svg[data-icon="arrow-left"]')).not.toBeNull();
    expect(link.textContent).toBe("");
  });

  it("has no interactive element when back and actions are absent", () => {
    const { container } = render(<PageHeader title="T" />);
    expect(container.querySelectorAll("a, button")).toHaveLength(0);
    expect(container.querySelector(".page-header")).not.toBeNull();
  });

  it("collapses the back track when there is no back link", () => {
    const { container } = render(<PageHeader title="T" />);
    const header = container.querySelector(".page-header") as HTMLElement;
    expect(header.classList.contains("page-header--no-back")).toBe(true);
    expect(header.querySelector(".page-header__back")).toBeNull();
  });

  it("keeps the back track when a back link exists", () => {
    const { container } = render(<PageHeader title="T" back={{ href: "/inicio", label: "Volver" }} />);
    const header = container.querySelector(".page-header") as HTMLElement;
    expect(header.classList.contains("page-header--no-back")).toBe(false);
    expect(header.querySelector(".page-header__back")).not.toBeNull();
  });

  it("renders the record id once and the meta line", () => {
    render(<PageHeader title="Titulo" eyebrowId="INC0001056" meta="Sub" />);
    expect(screen.getAllByText("INC0001056")).toHaveLength(1);
    expect(screen.getByText("Sub")).toBeTruthy();
  });

  it("puts actions in the right slot", () => {
    const { container } = render(<PageHeader title="T" actions={<button type="button">Accion</button>} />);
    const slot = container.querySelector(".page-header__actions") as HTMLElement;
    expect(slot).not.toBeNull();
    expect(slot.querySelector("button")?.textContent).toBe("Accion");
  });
});
