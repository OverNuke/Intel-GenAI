// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api-types";
import { TicketRecord } from "./ticket-record";

afterEach(cleanup);

type Record = components["schemas"]["ItTicketOut"];

export const record = (over: Partial<Record> = {}): Record => ({
  id: "INC0001056",
  summary: "Red lenta en toda el área de captura",
  description: "Las páginas tardan más de un minuto en cargar.",
  service: "network",
  service_label: "Red e internet",
  status: "in_progress",
  awaiting_user: false,
  priority: "critical",
  impact: "high",
  urgency: "high",
  assigned_group: "Soporte de redes",
  assignee_name: "Luis Herrera",
  requester_name: "Ana Ruiz",
  asset: null,
  via_ariadna: false,
  sla_due_at: "2026-01-08T15:00:00Z",
  sla_state: "overdue",
  created_at: "2026-01-08T17:00:00Z",
  updated_at: "2026-01-08T20:00:00Z",
  participants: [],
  events: [
    { id: "1056-1", kind: "created", body: null, author_name: "Ana Ruiz", visible_to_requester: true, created_at: "2026-01-08T17:00:00Z" },
    { id: "1056-2", kind: "assigned", body: null, author_name: "Luis Herrera", visible_to_requester: true, created_at: "2026-01-08T17:30:00Z" },
    { id: "1056-3", kind: "note", body: "Nota interna del equipo", author_name: "Luis Herrera", visible_to_requester: false, created_at: "2026-01-08T18:00:00Z" },
  ],
  receipt: null,
  ...over,
});

const noop = () => undefined;

describe("TicketRecord (T2)", () => {
  it("shows the id, requester, IT stage names with the current one marked, priority and SLA", () => {
    render(<TicketRecord ticket={record()} onContact={noop} />);
    expect(screen.getByRole("heading", { level: 1, name: "Red lenta en toda el área de captura" })).toBeTruthy();
    expect(screen.getByText("INC0001056")).toBeTruthy();
    expect(screen.getByText("Solicitante: Ana Ruiz")).toBeTruthy();
    const steps = within(screen.getByRole("list", { name: "Etapas del ticket" })).getAllByRole("listitem");
    expect(steps.map((s) => s.querySelector(".step-label")?.textContent)).toEqual([
      "Nuevo",
      "Asignado",
      "En curso",
      "Resuelto",
      "Cerrado",
    ]);
    expect(steps[2]!.getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("Crítica")).toBeTruthy();
    expect(screen.getByText("Vencido")).toBeTruthy();
    expect(screen.queryByText("Pendiente")).toBeNull();
  });

  it("flags Pendiente (text) when the ticket awaits the user", () => {
    render(<TicketRecord ticket={record({ awaiting_user: true })} onContact={noop} />);
    expect(screen.getByText("Pendiente")).toBeTruthy();
  });

  it("S-IT-D1: the status is a pill with IT wording, icon and tone, next to a single warning Pendiente pill", () => {
    render(<TicketRecord ticket={record({ awaiting_user: true })} onContact={noop} />);
    const status = screen.getByText("En curso", { selector: ".pill" });
    expect(status.className).toContain("tone-info");
    expect(status.querySelector('svg[data-icon="wrench"]')).not.toBeNull();
    const pending = screen.getAllByText("Pendiente");
    expect(pending).toHaveLength(1);
    expect(pending[0]!.className).toContain("tone-warning");
    expect(pending[0]!.querySelector('svg[data-icon="circle-alert"]')).not.toBeNull();
    // the id appears once as text; the head card uses the shared RecordHeader
    expect(screen.getAllByText("INC0001056")).toHaveLength(1);
  });

  it("S-IT-D1: the data rail is a complementary 'Datos del ticket' definition list with the six rows", () => {
    render(<TicketRecord ticket={record()} onContact={noop} />);
    const rail = screen.getByRole("complementary", { name: "Datos del ticket" });
    expect(rail.querySelectorAll("dl.rail-rows > .rail-row")).toHaveLength(6);
    expect(within(rail).getByText("Soporte de redes")).toBeTruthy();
    expect(within(rail).getByText("Luis Herrera")).toBeTruthy();
    const createdRow = within(rail).getByText("Creado").closest(".rail-row");
    expect(createdRow?.querySelector('svg[data-icon="clock"]')).not.toBeNull();
    expect(rail.querySelector('svg[data-icon="file-check"]')).toBeNull();
  });

  it("tabs switch between Resumen, Línea de tiempo and Bitácora", () => {
    render(<TicketRecord ticket={record()} onContact={noop} />);
    expect(screen.getByRole("tab", { name: "Resumen" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Las páginas tardan más de un minuto en cargar.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Línea de tiempo" }));
    const timeline = within(screen.getByRole("list", { name: "Línea de tiempo" })).getAllByRole("listitem");
    expect(timeline).toHaveLength(2); // the internal note is not part of the requester timeline

    fireEvent.click(screen.getByRole("tab", { name: "Bitácora" }));
    const log = within(screen.getByRole("list", { name: "Bitácora" })).getAllByRole("listitem");
    expect(log).toHaveLength(3);
    expect(log[2]!.textContent).toContain("Nota interna del equipo");
    expect(log[2]!.textContent).toContain("Luis Herrera");
  });

  it("S-IT-12: shows the receipt when the ticket came through Ariadna, a note when it did not", () => {
    const receipt = {
      understood: "La VPN no conecta.",
      reviewed: ["Datos obligatorios completos"],
      not_done: ["La persona envió la solicitud."],
      permissions_notice: null,
      missing_data: [],
      target_group: "Soporte de redes",
    };
    render(<TicketRecord ticket={record({ via_ariadna: true, receipt })} onContact={noop} />);
    expect(screen.getByRole("heading", { name: "Constancia de Ariadna" })).toBeTruthy();
    cleanup();
    render(<TicketRecord ticket={record()} onContact={noop} />);
    expect(screen.getByText("Este ticket no se creó con Ariadna.")).toBeTruthy();
  });

  it("S-UT-S2: T2 keeps the receipt outside .rec-body and never uses the U3 detail modifier", () => {
    const receipt = {
      understood: "La VPN no conecta.",
      reviewed: ["Datos obligatorios completos"],
      not_done: ["La persona envió la solicitud."],
      permissions_notice: null,
      missing_data: [],
      target_group: "Soporte de redes",
    };
    const { container } = render(<TicketRecord ticket={record({ via_ariadna: true, receipt })} onContact={noop} />);
    expect(container.querySelector(".rec-body--detail")).toBeNull();
    const heading = screen.getByRole("heading", { name: "Constancia de Ariadna" });
    expect(heading.closest(".rec-body")).toBeNull();
  });

  it("S-IT-13: only 'Contactar al usuario' works; the other actions are disabled with the stage note", () => {
    const onContact = vi.fn();
    render(<TicketRecord ticket={record()} onContact={onContact} />);
    const contact = screen.getByRole("button", { name: "Contactar al usuario" });
    expect((contact as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(contact);
    expect(onContact).toHaveBeenCalledTimes(1);
    for (const name of ["Tomar", "Reasignar", "Agregar nota", "Marcar como resuelto"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(button);
    }
    expect(onContact).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Próxima etapa del prototipo")).toBeTruthy();
  });

  it("T4 entry: «Ver correo de aviso» is a ghost link with the mail icon to the email preview", () => {
    render(<TicketRecord ticket={record()} onContact={noop} />);
    const link = screen.getByRole("link", { name: "Ver correo de aviso" });
    expect(link.className).toContain("btn");
    expect(link.className).toContain("btn-ghost");
    expect(link.getAttribute("href")).toBe("/ti/tickets/INC0001056/correo");
    expect(link.querySelector('svg[data-icon="mail"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Ver correo de aviso" })).toBeNull();
  });

  it("a finished ticket cannot be contacted", () => {
    render(<TicketRecord ticket={record({ status: "closed", sla_state: null })} onContact={noop} />);
    expect(screen.getByRole("button", { name: "Contactar al usuario" }).getAttribute("aria-disabled")).toBe("true");
  });
});

describe("TicketRecord agent v2 (T2)", () => {
  it("renders the new event kinds in the timeline and the log", () => {
    const ticket = record({
      events: [
        {
          id: "e1",
          kind: "updated",
          body: JSON.stringify({ summary: { before: "Red lenta", after: "Red caída" } }),
          author_name: "Ana Ruiz",
          visible_to_requester: true,
          created_at: "2026-01-08T18:00:00Z",
        },
        { id: "e2", kind: "closed", body: null, author_name: "Ana Ruiz", visible_to_requester: true, created_at: "2026-01-08T19:00:00Z" },
      ],
    });
    render(<TicketRecord ticket={ticket} onContact={noop} />);
    fireEvent.click(screen.getByRole("tab", { name: "Línea de tiempo" }));
    const timeline = within(screen.getByRole("list", { name: "Línea de tiempo" })).getAllByRole("listitem");
    expect(timeline[0]!.textContent).toContain("Cambió Resumen: Red lenta → Red caída");
    expect(timeline[1]!.textContent).toContain("Ticket cerrado");
    fireEvent.click(screen.getByRole("tab", { name: "Bitácora" }));
    const log = within(screen.getByRole("list", { name: "Bitácora" })).getAllByRole("listitem");
    expect(log[0]!.textContent).toContain("Ana Ruiz · Se actualizó el ticket");
    expect(log[0]!.textContent).toContain("Cambió Resumen: Red lenta → Red caída");
  });

  it("shows participants in the data block when present", () => {
    render(<TicketRecord ticket={record({ participants: ["Luis Herrera"] })} onContact={noop} />);
    expect(screen.getByText("Participantes").closest(".rail-row")!.textContent).toContain("Luis Herrera");
  });
});
