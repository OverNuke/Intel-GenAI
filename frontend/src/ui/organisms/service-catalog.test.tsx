// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { ServiceCatalog } from "./service-catalog";

afterEach(cleanup);

type Service = components["schemas"]["ServiceOut"];

const printing: Service = {
  key: "printing",
  label: "Impresión",
  description: "Impresoras y escáneres",
  examples: ["La impresora no imprime", "Se atora el papel"],
  have_at_hand: ["El piso o el nombre de la impresora."],
  handled_by: "Soporte de impresión",
  requires_manager_authorization: false,
};
const software: Service = {
  key: "software",
  label: "Software",
  description: "Instalar o actualizar programas",
  examples: ["Instalar un programa", "Un programa se cierra solo"],
  have_at_hand: ["El nombre del programa y para qué lo necesitas."],
  handled_by: "Soporte de software",
  requires_manager_authorization: true,
};

describe("ServiceCatalog (U4)", () => {
  it("S-SC-1: one card per service with examples, what to have at hand and who handles it", () => {
    render(<ServiceCatalog services={[printing, software]} />);
    expect(screen.getByRole("heading", { level: 1, name: "¿Qué necesitas?" })).toBeTruthy();
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    const card = cards[0]!;
    expect(within(card).getByRole("heading", { level: 2, name: "Impresión" })).toBeTruthy();
    expect(within(card).getByText("Impresoras y escáneres")).toBeTruthy();
    expect(within(card).getByText("Se atora el papel")).toBeTruthy();
    expect(within(card).getByText("El piso o el nombre de la impresora.")).toBeTruthy();
    expect(within(card).getByText("Lo atiende: Soporte de impresión")).toBeTruthy();
  });

  it("S-SC-2: only the service that needs it shows the manager-authorization notice", () => {
    render(<ServiceCatalog services={[printing, software]} />);
    const [printingCard, softwareCard] = screen.getAllByRole("article");
    expect(within(softwareCard!).getByText("Instalar programas necesita la autorización de tu jefe o encargado.")).toBeTruthy();
    expect(within(printingCard!).queryByRole("note")).toBeNull();
  });

  it("S-SC-3: each card starts the conversation scoped to its service; 'Nuevo ticket' starts an open one", () => {
    render(<ServiceCatalog services={[printing, software]} />);
    const links = screen.getAllByRole("link", { name: "Empezar con Ariadna" });
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/solicitud/conversacion?servicio=printing",
      "/solicitud/conversacion?servicio=software",
    ]);
    expect(screen.getByRole("link", { name: "Nuevo ticket" }).getAttribute("href")).toBe("/solicitud/conversacion");
  });

  it("shows one decorative icon tile per card; the h2 stays the accessible name", () => {
    const { container } = render(<ServiceCatalog services={[printing, software]} />);
    const [printingCard, softwareCard] = screen.getAllByRole("article");
    const tile = printingCard!.querySelector(".service-icon")!;
    expect(tile.getAttribute("aria-hidden")).toBe("true");
    expect(tile.querySelector("svg[data-icon='printer']")).not.toBeNull();
    expect(softwareCard!.querySelector(".service-icon svg[data-icon='app-window']")).not.toBeNull();
    expect(container.querySelectorAll(".service-icon")).toHaveLength(2);
    expect(screen.getByRole("article", { name: "Impresión" })).toBe(printingCard);
    expect(within(printingCard!).getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(within(printingCard!).getAllByRole("link")).toHaveLength(1);
  });

  it("renders a fallback icon for an unknown service key", () => {
    const unknown: Service = { ...printing, key: "brand-new", label: "Otro" };
    render(<ServiceCatalog services={[unknown]} />);
    const card = screen.getByRole("article", { name: "Otro" });
    expect(card.querySelector(".service-icon svg[data-icon='circle-ellipsis']")).not.toBeNull();
  });

  it("adds decorative icons to the meta rows without changing their text", () => {
    render(<ServiceCatalog services={[printing]} />);
    const card = screen.getByRole("article", { name: "Impresión" });
    for (const name of ["list-checks", "paperclip", "headset"]) {
      expect(card.querySelector(`svg[data-icon='${name}']`)).not.toBeNull();
    }
    expect(within(card).getByRole("heading", { level: 3, name: "Por ejemplo" })).toBeTruthy();
  });

  it("uses the shared page header with the new-ticket action", () => {
    const { container } = render(<ServiceCatalog services={[printing]} />);
    const header = container.querySelector("header.page-header")!;
    expect(container.querySelector(".page-head")).toBeNull();
    expect(header.querySelectorAll("h1")).toHaveLength(1);
    expect(header.querySelector(".page-header__actions a")?.getAttribute("href")).toBe("/solicitud/conversacion");
  });
});
