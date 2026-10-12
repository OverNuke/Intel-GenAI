// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { NotificationEmail as Email } from "@/lib/notification-email";
import { NotificationEmail } from "./notification-email";

afterEach(cleanup);

const email = (over: Partial<Email> = {}): Email => ({
  id: "INC0001055",
  from: "Mesa de ayuda TI · mesa.ayuda@ejemplo.mx",
  to: "Soporte de redes",
  cc: "Sin datos de ejemplo",
  subject: "Nuevo ticket INC0001055: Red lenta",
  via: " con ayuda de Ariadna",
  summary: "Red lenta",
  description: "Lenta. · Desde ayer.",
  requester: "Ana Ruiz",
  area: "Sin datos de ejemplo",
  location: "Sin datos de ejemplo",
  contact: "Sin datos de ejemplo",
  impact: "Afecta a toda mi área",
  urgency: "No puedo trabajar",
  asset: "Ninguno",
  attachments: "Sin datos de ejemplo",
  ...over,
});

describe("NotificationEmail (T4)", () => {
  it("is a card with a rail-rows header of De, Para, Cc and Asunto", () => {
    const { container } = render(<NotificationEmail email={email()} />);
    expect(container.querySelector("article.card.mail > dl.rail-rows.mail-head")).not.toBeNull();
    const head = container.querySelector("dl.mail-head") as HTMLElement;
    const rows = Array.from(head.querySelectorAll(".rail-row")).map((row) => [
      row.querySelector("dt")?.textContent,
      row.querySelector("dd")?.textContent,
    ]);
    expect(rows).toEqual([
      ["De", "Mesa de ayuda TI · mesa.ayuda@ejemplo.mx"],
      ["Para", "Soporte de redes"],
      ["Cc", "Sin datos de ejemplo"],
      ["Asunto", "Nuevo ticket INC0001055: Red lenta"],
    ]);
  });

  it("body says the ticket was created, with the Ariadna suffix only when present", () => {
    render(<NotificationEmail email={email()} />);
    expect(screen.getByText("Se creó un ticket nuevo con ayuda de Ariadna.")).toBeTruthy();
    cleanup();
    render(<NotificationEmail email={email({ via: "" })} />);
    expect(screen.getByText("Se creó un ticket nuevo.")).toBeTruthy();
  });

  it("lists the body fields and shows the placeholder for absent data", () => {
    const { container } = render(<NotificationEmail email={email()} />);
    const body = container.querySelector(".mail-body") as HTMLElement;
    for (const label of ["Resumen", "Descripción", "Solicitante", "Impacto", "Urgencia", "Activo", "Adjuntos"]) {
      expect(within(body).getByText(label)).toBeTruthy();
    }
    expect(body.textContent).toContain("Ana Ruiz · Sin datos de ejemplo · Sin datos de ejemplo · Sin datos de ejemplo");
    expect(body.textContent).toContain("Lenta. · Desde ayer.");
    expect(body.textContent).toContain("Afecta a toda mi área");
  });

  it("links to the ticket record, notes it is sample data and has no primary action", () => {
    const { container } = render(<NotificationEmail email={email()} />);
    expect(screen.getByRole("link", { name: "Ver el ticket" }).getAttribute("href")).toBe("/ti/tickets/INC0001055");
    expect(
      screen.getByText(
        "Datos de ejemplo · Los destinatarios adicionales según cuántas personas afecta están por definir.",
      ),
    ).toBeTruthy();
    expect(container.querySelector(".btn-primary")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
