import { describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { buildNotificationEmail } from "./notification-email";

type Ticket = components["schemas"]["ItTicketOut"];

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: "INC0001055",
  summary: "Red lenta en captura",
  description: "Las páginas tardan.\nEmpezó ayer.\nTercera línea.",
  service: "network",
  service_label: "Red e internet",
  status: "new",
  awaiting_user: false,
  priority: "high",
  impact: "high",
  urgency: "medium",
  assigned_group: "Soporte de redes",
  assignee_name: null,
  requester_name: "Ana Ruiz",
  asset: null,
  via_ariadna: true,
  sla_due_at: null,
  sla_state: null,
  created_at: "2026-01-08T17:00:00Z",
  updated_at: "2026-01-08T17:00:00Z",
  participants: [],
  events: [],
  receipt: null,
  ...over,
});

describe("buildNotificationEmail", () => {
  it("builds the header: fixed sender, assigned group and the subject with id and summary", () => {
    const email = buildNotificationEmail(ticket());
    expect(email.from).toBe("Mesa de ayuda TI · mesa.ayuda@ejemplo.mx");
    expect(email.to).toBe("Soporte de redes");
    expect(email.subject).toBe("Nuevo ticket INC0001055: Red lenta en captura");
    expect(email.id).toBe("INC0001055");
  });

  it("adds the Ariadna suffix only when the ticket came through Ariadna", () => {
    expect(buildNotificationEmail(ticket()).via).toBe(" con ayuda de Ariadna");
    expect(buildNotificationEmail(ticket({ via_ariadna: false })).via).toBe("");
  });

  it("joins the first two description lines with ' · ' and ignores blank lines", () => {
    expect(buildNotificationEmail(ticket()).description).toBe("Las páginas tardan. · Empezó ayer.");
    expect(buildNotificationEmail(ticket({ description: "\n  \nSolo una." })).description).toBe("Solo una.");
    expect(buildNotificationEmail(ticket({ description: "" })).description).toBe("Sin datos de ejemplo");
  });

  it("falls back to the placeholder for the asset and for every field the API does not return", () => {
    const email = buildNotificationEmail(ticket());
    expect(email.asset).toBe("Ninguno");
    expect(email.cc).toBe("Sin datos de ejemplo");
    expect(email.area).toBe("Sin datos de ejemplo");
    expect(email.location).toBe("Sin datos de ejemplo");
    expect(email.contact).toBe("Sin datos de ejemplo");
    expect(email.attachments).toBe("Sin datos de ejemplo");
    expect(buildNotificationEmail(ticket({ asset: "PC-0042" })).asset).toBe("PC-0042");
  });

  it("carries the requester, impact and urgency labels", () => {
    const email = buildNotificationEmail(ticket());
    expect(email.requester).toBe("Ana Ruiz");
    expect(email.impact).toBe("Afecta a toda mi área");
    expect(email.urgency).toBe("Puedo trabajar con dificultad");
  });

  it("never throws on missing optional fields", () => {
    const broken = { id: "INC1" } as unknown as Ticket;
    expect(() => buildNotificationEmail(broken)).not.toThrow();
  });
});
