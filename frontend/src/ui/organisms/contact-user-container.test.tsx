// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api-types";
import { ContactUserContainer } from "./contact-user-container";

afterEach(cleanup);

type Record = components["schemas"]["ItTicketOut"];

const base: Record = {
  id: "INC0001060",
  summary: "El teléfono IP de recepción no tiene tono",
  description: "No marca ni recibe llamadas.",
  service: "hardware",
  service_label: "Equipo de cómputo",
  status: "assigned",
  awaiting_user: false,
  priority: "high",
  impact: "medium",
  urgency: "high",
  assigned_group: "Soporte TI",
  assignee_name: "Luis Herrera",
  requester_name: "Ana Ruiz",
  asset: "TEL-0061",
  via_ariadna: false,
  sla_due_at: "2026-01-14T16:00:00Z",
  sla_state: "on_time",
  created_at: "2026-01-14T14:00:00Z",
  updated_at: "2026-01-14T16:00:00Z",
  events: [{ id: "1060-1", kind: "created", body: null, author_name: "Ana Ruiz", visible_to_requester: true, created_at: "2026-01-14T14:00:00Z" }],
  receipt: null,
  participants: [],
};

const after: Record = {
  ...base,
  awaiting_user: true,
  events: [
    ...base.events,
    {
      id: "1060-2",
      kind: "contact_requested",
      body: "Confirma la extensión del teléfono",
      author_name: "Luis Herrera",
      visible_to_requester: true,
      created_at: "2026-01-14T17:00:00Z",
    },
  ],
};

const reply = (status: number, body: unknown) => vi.fn(async () => Response.json(body, { status }));
const open = () => fireEvent.click(screen.getByRole("button", { name: "Contactar al usuario" }));
const bodyOf = (f: ReturnType<typeof reply>) =>
  JSON.parse(((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string) ?? "{}");

describe("ContactUserContainer (T2)", () => {
  it("opens a panel that explains the effect and can be cancelled without sending", () => {
    const f = reply(200, after);
    render(<ContactUserContainer initial={base} fetchImpl={f as unknown as typeof fetch} />);
    open();
    expect(screen.getByRole("heading", { name: "Contactar a Ana Ruiz" })).toBeTruthy();
    expect(screen.getByText(/El ticket pasa a Pendiente/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("heading", { name: "Contactar a Ana Ruiz" })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("S-IT-8: sends the message, then shows Pendiente and the new timeline entry from the API", async () => {
    const f = reply(200, after);
    render(<ContactUserContainer initial={base} fetchImpl={f as unknown as typeof fetch} />);
    expect(screen.queryByText("Pendiente")).toBeNull();
    open();
    fireEvent.change(screen.getByLabelText("¿Qué dato falta o está mal?"), {
      target: { value: "Confirma la extensión del teléfono" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar y dejar en Pendiente" }));
    await waitFor(() => expect(screen.getByText("Pendiente")).toBeTruthy());
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(url).toBe("/api/it/tickets/INC0001060/contact");
    expect(bodyOf(f)).toEqual({ message: "Confirma la extensión del teléfono" });
    expect(screen.queryByRole("heading", { name: "Contactar a Ana Ruiz" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Bitácora" }));
    expect(screen.getByText("Confirma la extensión del teléfono")).toBeTruthy();
  });

  it("the message is optional", async () => {
    const f = reply(200, after);
    render(<ContactUserContainer initial={base} fetchImpl={f as unknown as typeof fetch} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Enviar y dejar en Pendiente" }));
    await waitFor(() => expect(screen.getByText("Pendiente")).toBeTruthy());
    expect(bodyOf(f)).toEqual({});
  });

  it("S-IT-10: a 409 explains that the ticket is already finished and changes nothing", async () => {
    const f = reply(409, { reason: "ticket-finished" });
    render(<ContactUserContainer initial={base} fetchImpl={f as unknown as typeof fetch} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Enviar y dejar en Pendiente" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("ya está resuelto o cerrado"));
    expect(screen.queryByText("Pendiente")).toBeNull();
  });

  it("a server error keeps the panel and the typed message so the person can retry", async () => {
    const f = reply(500, {});
    render(<ContactUserContainer initial={base} fetchImpl={f as unknown as typeof fetch} />);
    open();
    fireEvent.change(screen.getByLabelText("¿Qué dato falta o está mal?"), { target: { value: "Mi mensaje" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar y dejar en Pendiente" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No pudimos enviar"));
    expect((screen.getByLabelText("¿Qué dato falta o está mal?") as HTMLTextAreaElement).value).toBe("Mi mensaje");
  });
});
