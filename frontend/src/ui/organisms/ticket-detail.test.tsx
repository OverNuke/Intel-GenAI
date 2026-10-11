// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { AriadnaReceipt } from "./ariadna-receipt";
import { DetailViewTabs } from "./detail-view-tabs";
import { NeedDataNotice } from "./need-data-notice";
import { RecordHeader } from "./record-header";
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
  it("shows id, summary, status pill, dates and the data rail in user language", () => {
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    expect(screen.getByRole("heading", { level: 1, name: "Red lenta en toda el área de captura" })).toBeTruthy();
    expect(screen.getAllByText("INC0001056").length).toBeGreaterThan(0);
    expect(screen.getByText("Red e internet")).toBeTruthy();
    // Label and value are separate nodes in the record header.
    expect(screen.getByText("Última actualización")).toBeTruthy();
    expect(screen.getByText("8 ene 2026, 14:00")).toBeTruthy();
    expect(screen.getByText("Creado: 8 ene 2026, 11:00")).toBeTruthy();
    expect(screen.getByText("Las páginas tardan más de un minuto en cargar.")).toBeTruthy();
    // The status pill keeps the user label and carries an icon (never colour only).
    const pill = screen.getAllByText("En revisión por TI").find((el) => el.classList.contains("pill"));
    expect(pill?.querySelector('[data-icon="wrench"]')).toBeTruthy();
  });

  it("S-UT-D3: the aside lists exactly 8 rows with icons, incl. Adjuntos and Creado", () => {
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    const aside = screen.getByRole("complementary", { name: "Datos del ticket" });
    const terms = within(aside).getAllByRole("term");
    expect(terms.map((t) => t.textContent)).toEqual([
      "Solicitante",
      "Impacto",
      "Urgencia",
      "Grupo asignado",
      "Lo atiende",
      "Activo relacionado",
      "Adjuntos",
      "Creado",
    ]);
    expect(aside.querySelectorAll(".rail-row svg")).toHaveLength(8);
    const createdRow = within(aside).getByText("Creado").closest(".rail-row");
    expect(createdRow?.querySelector('svg[data-icon="clock"]')).not.toBeNull();
    expect(aside.querySelector('svg[data-icon="file-check"]')).toBeNull();
    expect(aside.textContent).toContain("Ana Ruiz");
    expect(aside.textContent).toContain("Afecta a toda mi área");
    expect(aside.textContent).toContain("Puedo trabajar con dificultad");
    expect(aside.textContent).toContain("Soporte TI");
    expect(aside.textContent).toContain("Luis Herrera");
    expect(aside.textContent).toContain("8 ene 2026, 11:00");
    const defs = within(aside).getAllByRole("definition");
    expect(defs[5]!.textContent).toBe("Ninguno");
    expect(defs[6]!.textContent).toBe("Ninguno");
  });

  it("falls back to 'Sin asignar' and shows the asset when present", () => {
    render(<TicketDetail ticket={detail({ assignee_name: null, asset: "MON-0238" })} requesterName="Ana Ruiz" />);
    const aside = screen.getByRole("complementary", { name: "Datos del ticket" });
    expect(aside.textContent).toContain("Sin asignar");
    expect(aside.textContent).toContain("MON-0238");
  });

  it("S-UT-D4: keeps the list named 'Línea de tiempo' with the life stages and dates", () => {
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    const items = within(screen.getByRole("list", { name: "Línea de tiempo" })).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]!.textContent).toContain("Recibido");
    expect(items[0]!.textContent).toContain("8 ene 2026, 11:00");
    expect(items[1]!.textContent).toContain("Lo tomó Luis Herrera");
    expect(items[3]!.textContent).toContain("Por venir");
  });

  it("renders the wide stage stepper as 'Etapas del ticket'", () => {
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    expect(within(screen.getByRole("list", { name: "Etapas del ticket" })).getAllByRole("listitem")).toHaveLength(5);
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
    expect(notice.querySelector('[data-icon="circle-alert"]')).toBeTruthy();
    expect(notice.classList.contains("tone-warning")).toBe(true);
    cleanup();
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("S-UT-D1: the header adds one pending flag only while awaiting the user", () => {
    render(<TicketDetail ticket={detail({ awaiting_user: true })} requesterName="Ana Ruiz" />);
    const flags = screen.getAllByText("Necesitamos un dato de tu parte").filter((el) => el.classList.contains("pill"));
    expect(flags).toHaveLength(1);
    cleanup();
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    expect(screen.queryAllByText("Necesitamos un dato de tu parte")).toHaveLength(0);
  });

  it("offers the icon help entry scoped to this ticket (UT-18, S-UT-D7)", () => {
    render(<TicketDetail ticket={detail()} requesterName="Ana Ruiz" />);
    const help = screen.getByRole("link", { name: "Ayuda con este ticket" });
    expect(help.getAttribute("href")).toBe("/solicitud/conversacion?ticket=INC0001056");
    expect(help.querySelector('[data-icon="circle-help"]')).toBeTruthy();
    expect(help.textContent).toBe("");
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

describe("RecordHeader", () => {
  it("renders crumb, id, title, optional help, sample chip and its cells", () => {
    render(
      <RecordHeader
        crumb={{ href: "/x", label: "Volver" }}
        id="INC1"
        title="Titulo"
        subtitle="Sub"
        help={{ href: "/ayuda", label: "Ayuda" }}
        sample
      >
        <div>celda</div>
      </RecordHeader>,
    );
    expect(screen.getByRole("link", { name: "Volver" }).getAttribute("href")).toBe("/x");
    expect(screen.getByRole("heading", { level: 1, name: "Titulo" })).toBeTruthy();
    expect(screen.getByText("Sub")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ayuda" }).getAttribute("href")).toBe("/ayuda");
    expect(screen.getByText("Datos de ejemplo")).toBeTruthy();
    expect(screen.getByText("celda")).toBeTruthy();
    cleanup();
    render(
      <RecordHeader crumb={{ href: "/x", label: "Volver" }} id="INC1" title="Titulo">
        <div>celda</div>
      </RecordHeader>,
    );
    expect(screen.queryByText("Datos de ejemplo")).toBeNull();
    expect(screen.queryByRole("link", { name: "Ayuda" })).toBeNull();
  });
});

describe("DetailViewTabs", () => {
  it("switches the compact view between Resumen and Línea de tiempo without removing panels", () => {
    render(<DetailViewTabs summary={<p>resumen</p>} timeline={<ol aria-label="Línea de tiempo" />} />);
    const tabs = within(screen.getByRole("tablist", { name: "Vista del ticket" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Resumen", "Línea de tiempo"]);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    const timelinePanel = () => screen.getByRole("list", { name: "Línea de tiempo" }).closest('[role="tabpanel"]')!;
    const summaryPanel = () => screen.getByText("resumen").closest('[role="tabpanel"]')!;
    expect(timelinePanel().classList.contains("is-inactive")).toBe(true);
    expect(summaryPanel().classList.contains("is-inactive")).toBe(false);
    fireEvent.click(tabs[1]!);
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
    expect(timelinePanel().classList.contains("is-inactive")).toBe(false);
    expect(summaryPanel().classList.contains("is-inactive")).toBe(true);
    // Arrow keys move between tabs.
    fireEvent.keyDown(tabs[1]!, { key: "ArrowLeft" });
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
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

  it("S-UT-D2: numbers each stage and states earlier=done, later=pending as text", () => {
    render(<StageTracker status="in_progress" awaitingUser={false} />);
    const steps = within(screen.getByRole("list", { name: "Etapas del ticket" })).getAllByRole("listitem");
    expect(steps.map((s) => s.querySelector(".step-num")?.textContent)).toEqual(["1", "2", "3", "4", "5"]);
    expect(steps.map((s) => s.querySelector(".step-state")?.textContent)).toEqual([
      "Completado",
      "Completado",
      "Paso actual",
      "Por venir",
      "Por venir",
    ]);
  });

  it("flags the current stage as pending when the ticket awaits the user", () => {
    render(<StageTracker status="in_progress" awaitingUser={true} />);
    const current = screen
      .getAllByRole("listitem")
      .find((li) => li.getAttribute("aria-current") === "step");
    expect(current?.textContent).toContain("Necesitamos un dato de tu parte");
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("T2 compatibility: IT labels and no pending note when pendingLabel is null", () => {
    render(
      <StageTracker
        status="assigned"
        awaitingUser={true}
        labels={{ new: "Nuevo", assigned: "Asignado", in_progress: "En curso", resolved: "Resuelto", closed: "Cerrado" }}
        pendingLabel={null}
      />,
    );
    const current = screen
      .getAllByRole("listitem")
      .find((li) => li.getAttribute("aria-current") === "step");
    expect(current?.textContent).toContain("Asignado");
    expect(current?.textContent).not.toContain("Necesitamos un dato de tu parte");
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
