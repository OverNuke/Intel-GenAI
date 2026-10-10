// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { AriadnaReceipt } from "./ariadna-receipt";
import { NeedDataNotice } from "./need-data-notice";
import { StageTracker } from "./stage-tracker";
import { TicketDetail } from "./ticket-detail";
import { Timeline } from "./timeline";

afterEach(cleanup);

type Detail = components["schemas"]["TicketDetailOut"];

const detail = (over: Partial<Detail> = {}): Detail => ({
  id: "INC0001056",
  summary: "Red lenta en toda el área de captura",
  service: "network",
  service_label: "Red e internet",
  status: "in_progress",
  awaiting_user: false,
  via_ariadna: false,
  asset: null,
  created_at: "2026-01-08T17:00:00Z",
  updated_at: "2026-01-08T20:00:00Z",
  description: "Las páginas tardan más de un minuto en cargar.",
  impact: "high",
  urgency: "medium",
  assigned_group: "Soporte TI",
  assignee_name: "Luis Herrera",
  events: [
    { id: "1056-1", kind: "created", body: null, created_at: "2026-01-08T17:00:00Z" },
    { id: "1056-2", kind: "assigned", body: null, created_at: "2026-01-08T17:30:00Z" },
  ],
  contact_notice: null,
  receipt: null,
  ...over,
});

describe("TicketDetail (U3)", () => {
  it("shows id, summary, current state, dates and the data block in user language", () => {
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    expect(screen.getByRole("heading", { level: 1, name: "Red lenta en toda el área de captura" })).toBeTruthy();
    expect(screen.getAllByText("INC0001056").length).toBeGreaterThan(0);
    expect(screen.getByText("Creado: 8 ene 2026, 11:00")).toBeTruthy();
    expect(screen.getByText("Última actualización: 8 ene 2026, 14:00")).toBeTruthy();
    expect(screen.getByText("Las páginas tardan más de un minuto en cargar.")).toBeTruthy();
    const data = screen.getByRole("list", { name: "Datos del ticket" });
    expect(data.textContent).toContain("Ana Ruiz");
    expect(data.textContent).toContain("Afecta a toda mi área");
    expect(data.textContent).toContain("Puedo trabajar con dificultad");
    expect(data.textContent).toContain("Soporte TI");
    expect(data.textContent).toContain("Luis Herrera");
    expect(data.textContent).toContain("Ninguno");
  });

  it("falls back to 'Sin asignar' and shows the asset when present", () => {
    render(<TicketDetail ticket={detail({ assignee_name: null, asset: "MON-0238" })} requesterName="Ana Ruiz" />);
    const data = screen.getByRole("list", { name: "Datos del ticket" });
    expect(data.textContent).toContain("Sin asignar");
    expect(data.textContent).toContain("MON-0238");
  });

  it("S-UT-13: shows the need-data notice with the IT message only while awaiting the user", () => {
    render(
      <TicketDetail
        ticket={detail({ awaiting_user: true, contact_notice: "Confirma la extensión del teléfono" })}
        requesterName="Ana Ruiz"
      />,
    );
    const notice = screen.getByRole("note");
    expect(within(notice).getByText("Necesitamos un dato de tu parte")).toBeTruthy();
    expect(within(notice).getByText("Confirma la extensión del teléfono")).toBeTruthy();
    cleanup();
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("offers the (?) help entry scoped to this ticket (UT-18)", () => {
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    const help = screen.getByRole("link", { name: "Ayuda con este ticket" });
    expect(help.getAttribute("href")).toBe("/solicitud/conversacion?ticket=INC0001056");
    expect(screen.getByRole("link", { name: "Mis tickets" }).getAttribute("href")).toBe("/tickets");
  });

  it("renders the stored receipt when present and omits it otherwise (UT-19)", () => {
    const receipt = {
      understood: "No hay red en el área de captura.",
      reviewed: ["Datos obligatorios completos"],
      not_done: ["La persona presionó «Enviar solicitud». Ariadna no envía nada."],
      permissions_notice: null,
      missing_data: [],
      target_group: "Soporte de redes",
    };
    render(<TicketDetail ticket={detail({ receipt })} requesterName="Ana Ruiz" />);
    expect(screen.getByRole("heading", { name: "Constancia de Ariadna" })).toBeTruthy();
    cleanup();
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    expect(screen.queryByRole("heading", { name: "Constancia de Ariadna" })).toBeNull();
  });

  it("S-SC-4: an unknown service still renders with the label the API sent", () => {
    render(
      <TicketDetail
        ticket={detail({ service: "unknown-x", service_label: "Otra cosa" })}
        requesterName="Ana Ruiz"
      />,
    );
    expect(screen.getByText("Otra cosa")).toBeTruthy();
  });
});

describe("StageTracker", () => {
  it("marks the current stage and earlier ones as done (S-UT-15)", () => {
    render(<StageTracker status="in_progress" awaitingUser={false} />);
    const steps = within(screen.getByRole("list", { name: "Etapas del ticket" })).getAllByRole("listitem");
    expect(steps).toHaveLength(5);
    expect(steps[0]!.textContent).toContain("Completado");
    expect(steps[2]!.getAttribute("aria-current")).toBe("step");
    expect(steps[2]!.textContent).toContain("En revisión por TI");
    expect(steps[2]!.textContent).toContain("Paso actual");
    expect(steps[3]!.textContent).toContain("Por venir");
    expect(steps.filter((s) => s.getAttribute("aria-current") === "step")).toHaveLength(1);
  });

  it("flags the current stage as pending when the ticket awaits the user", () => {
    render(<StageTracker status="in_progress" awaitingUser={true} />);
    const current = screen
      .getAllByRole("listitem")
      .find((li) => li.getAttribute("aria-current") === "step");
    expect(current?.textContent).toContain("Necesitamos un dato de tu parte");
  });
});

describe("Timeline and NeedDataNotice", () => {
  it("lists events oldest first with plain labels and the IT message", () => {
    render(
      <Timeline
        events={[
          { id: "a", kind: "created", body: null, created_at: "2026-01-08T17:00:00Z" },
          { id: "b", kind: "contact_requested", body: "Confirma la extensión", created_at: "2026-01-08T19:00:00Z" },
        ]}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Línea de tiempo" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain("Ticket creado");
    expect(items[1]!.textContent).toContain("TI te pidió un dato");
    expect(items[1]!.textContent).toContain("Confirma la extensión");
  });

  it("NeedDataNotice shows the generic text when IT left no message", () => {
    render(<NeedDataNotice message={null} />);
    expect(screen.getByText("Necesitamos un dato de tu parte")).toBeTruthy();
    expect(screen.getByText("Para responder, usa el botón de ayuda (?) junto al título.")).toBeTruthy();
  });
});

describe("AriadnaReceipt", () => {
  it("shows what was understood, reviewed, not done and the target group", () => {
    render(
      <AriadnaReceipt
        receipt={{
          understood: "La VPN no conecta desde casa.",
          reviewed: ["Datos obligatorios completos", "Destino sugerido: Soporte de redes"],
          not_done: ["La persona envió la solicitud."],
          permissions_notice: "Instalar programas necesita la autorización de tu jefe.",
          missing_data: ["Autorización del jefe"],
          target_group: "Soporte de redes",
        }}
      />,
    );
    expect(screen.getByText("La VPN no conecta desde casa.")).toBeTruthy();
    const reviewed = screen.getByRole("list", { name: "Validaciones realizadas" });
    expect(within(reviewed).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("list", { name: "Dónde participó una persona" })).toBeTruthy();
    expect(screen.getByText("Instalar programas necesita la autorización de tu jefe.")).toBeTruthy();
    expect(screen.getByText("Autorización del jefe")).toBeTruthy();
    expect(screen.getByText("Soporte de redes", { selector: "strong" })).toBeTruthy();
  });

  it("omits the empty optional blocks", () => {
    render(
      <AriadnaReceipt
        receipt={{
          understood: "x",
          reviewed: ["Datos obligatorios completos"],
          not_done: [],
          permissions_notice: null,
          missing_data: [],
          target_group: "Soporte de redes",
        }}
      />,
    );
    expect(screen.queryByRole("list", { name: "Dónde participó una persona" })).toBeNull();
    expect(screen.queryByText("Datos que faltaban")).toBeNull();
  });
});
