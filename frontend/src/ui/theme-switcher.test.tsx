// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeSwitcher } from "./theme-switcher";

beforeEach(() => {
  document.documentElement.dataset.theme = "grayscale";
});
afterEach(cleanup);

const open = () => fireEvent.click(screen.getByRole("button", { name: "Barra de prototipo" }));
const radio = (name: string) => screen.getByRole("radio", { name });

describe("ThemeSwitcher (prototype bar)", () => {
  it("is a region 'Barra de prototipo', collapsed by default", () => {
    render(<ThemeSwitcher />);
    const region = screen.getByRole("region", { name: "Barra de prototipo" });
    const toggle = within(region).getByRole("button", { name: "Barra de prototipo" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("proto-panel");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("opens a radiogroup 'Tema' with Grayscale, Azul and Verde", () => {
    render(<ThemeSwitcher />);
    open();
    expect(screen.getByRole("button", { name: "Barra de prototipo" }).getAttribute("aria-expanded")).toBe("true");
    const group = screen.getByRole("radiogroup", { name: "Tema" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Grayscale", "Azul", "Verde"]);
  });

  it("marks the current theme checked and uses a roving tabindex", () => {
    render(<ThemeSwitcher />);
    open();
    expect(radio("Grayscale").getAttribute("aria-checked")).toBe("true");
    expect(radio("Azul").getAttribute("aria-checked")).toBe("false");
    expect(radio("Grayscale").getAttribute("tabindex")).toBe("0");
    expect(radio("Azul").getAttribute("tabindex")).toBe("-1");
    expect(radio("Verde").getAttribute("tabindex")).toBe("-1");
  });

  it("choosing a radio applies data-theme on <html> and updates the roving state", () => {
    render(<ThemeSwitcher />);
    open();
    fireEvent.click(radio("Azul"));
    expect(document.documentElement.dataset.theme).toBe("azul");
    expect(radio("Azul").getAttribute("aria-checked")).toBe("true");
    expect(radio("Grayscale").getAttribute("aria-checked")).toBe("false");
    expect(radio("Azul").getAttribute("tabindex")).toBe("0");
    expect(radio("Grayscale").getAttribute("tabindex")).toBe("-1");
  });

  it("arrow keys move selection and focus, wrapping around", () => {
    render(<ThemeSwitcher />);
    open();
    fireEvent.keyDown(radio("Grayscale"), { key: "ArrowRight" });
    expect(document.documentElement.dataset.theme).toBe("azul");
    expect(document.activeElement).toBe(radio("Azul"));
    fireEvent.keyDown(radio("Azul"), { key: "ArrowDown" });
    expect(document.documentElement.dataset.theme).toBe("verde");
    fireEvent.keyDown(radio("Verde"), { key: "ArrowRight" });
    expect(document.documentElement.dataset.theme).toBe("grayscale");
    fireEvent.keyDown(radio("Grayscale"), { key: "ArrowLeft" });
    expect(document.documentElement.dataset.theme).toBe("verde");
    expect(document.activeElement).toBe(radio("Verde"));
  });

  it("starts from the theme already on <html>", () => {
    document.documentElement.dataset.theme = "verde";
    render(<ThemeSwitcher />);
    open();
    expect(radio("Verde").getAttribute("aria-checked")).toBe("true");
  });
});
