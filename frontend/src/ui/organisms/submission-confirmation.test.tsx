// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { SubmissionConfirmation } from "./submission-confirmation";

afterEach(cleanup);

type Detail = components["schemas"]["TicketDetailOut"];

const ticket = (over: Partial<Detail> = {}): Detail => ({
  id: "INC0001061",
  summary: "La impresora no imprime",
  service: "printing",
  service_label: "Impresión",
  status: "new",
  awaiting_user: false,
  via_ariadna: true,
  asset: null,
  created_at: "2026-10-09T18:00:00Z",
  updated_at: "2026-10-09T18:00:00Z",
  description: "Los documentos se quedan en la cola.",
  impact: "medium",
  urgency: "medium",
  assigned_group: "Soporte de impresión",
  assignee_name: null,
  events: [{ id: "1061-1", kind: "created", body: null, created_at: "2026-10-09T18:00:00Z" }],
  contact_notice: null,
  participants: [],
  receipt: {
    understood: "La impresora no imprime.",
    reviewed: ["Datos obligatorios completos"],
    not_done: ["La persona revisó y presionó «Enviar solicitud». Ariadna no envía nada."],
    permissions_notice: null,
    missing_data: [],
    target_group: "Soporte de impresión",
  },
  ...over,
});

describe("SubmissionConfirmation (U7)", () => {
  it("S-TS-11: shows the new id, the receipt and a link to Mis tickets", () => {
    render(<SubmissionConfirmation ticket={ticket()} />);
    expect(screen.getByText("INC0001061")).toBeTruthy();
    expect(screen.getByText("Enviamos tu solicitud. Te avisaremos cuando la tome un especialista.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Constancia de Ariadna" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver mis tickets" }).getAttribute("href")).toBe("/tickets");
    expect(screen.getByRole("link", { name: "Ver el ticket" }).getAttribute("href")).toBe("/tickets/INC0001061");
  });

  it("S-U7-1: shows the notification line with a mail icon after the sent body and before the receipt", () => {
    const { container } = render(<SubmissionConfirmation ticket={ticket()} />);
    const line = screen.getByText("Avisamos a TI y a tu jefe o encargado por correo.");
    expect(line.closest("p")?.querySelector('svg[data-icon="mail"]')).toBeTruthy();
    const body = screen.getByText("Enviamos tu solicitud. Te avisaremos cuando la tome un especialista.");
    const receipt = screen.getByRole("heading", { name: "Constancia de Ariadna" });
    expect(body.compareDocumentPosition(line.closest("p")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.closest("p")!.compareDocumentPosition(receipt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);
  });

  it("without a receipt (Pasar con TI) it explains that a person from IT will see the case", () => {
    render(<SubmissionConfirmation ticket={ticket({ receipt: null, via_ariadna: false })} />);
    expect(screen.queryByRole("heading", { name: "Constancia de Ariadna" })).toBeNull();
    expect(screen.getByText("Una persona de TI verá tu caso. No tienes que repetir nada.")).toBeTruthy();
  });

  it("uses the shared page header: one h1 with the ticket id once as eyebrow, no legacy markup", () => {
    const { container } = render(<SubmissionConfirmation ticket={ticket()} />);
    const header = container.querySelector("header.page-header")!;
    expect(header.querySelectorAll("h1")).toHaveLength(1);
    expect(header.querySelector(".t-id")?.textContent).toBe("INC0001061");
    expect(screen.getAllByText("INC0001061")).toHaveLength(1);
  });
});
