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
});
