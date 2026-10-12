// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProposalCard, type ProposalCardProps } from "./proposal-card";

afterEach(cleanup);

const base = {
  status: "idle",
  message: null,
  notes: [],
  ticketRef: null,
  before: {},
  draft: null,
  blocked: false,
  onConfirm: () => undefined,
  onDismiss: () => undefined,
} satisfies Omit<ProposalCardProps, "proposal">;

const DRAFT = {
  serviceLabel: "Equipo de cómputo",
  summary: "PC con cables pelados",
  description: "Los cables de mi PC están pelados.",
  impact: "Solo me afecta a mí",
  urgency: "No puedo trabajar",
};

describe("ProposalCard", () => {
  it("create_ticket: shows the draft and a Confirmar y enviar action; nothing runs by itself", () => {
    const onConfirm = vi.fn();
    render(<ProposalCard {...base} proposal={{ kind: "create_ticket" }} draft={DRAFT} onConfirm={onConfirm} />);
    expect(screen.getByText("PC con cables pelados")).toBeTruthy();
    expect(screen.getByText("Equipo de cómputo")).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y enviar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("create_ticket: is disabled with a reason while blocking items exist", () => {
    const onConfirm = vi.fn();
    render(<ProposalCard {...base} proposal={{ kind: "create_ticket" }} draft={DRAFT} blocked onConfirm={onConfirm} />);
    const button = screen.getByRole("button", { name: "Confirmar y enviar" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Antes de enviar, completa lo que falta.")).toBeTruthy();
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("add_participants with a ticket: lists the names and confirms", () => {
    const onConfirm = vi.fn();
    render(
      <ProposalCard
        {...base}
        proposal={{ kind: "add_participants", names: ["Luis Herrera", "Marta Díaz"], ticket_ref: "INC0001056" }}
        ticketRef="INC0001056"
        onConfirm={onConfirm}
      />,
    );
    const names = within(screen.getByRole("list", { name: "Personas" })).getAllByRole("listitem");
    expect(names.map((n) => n.textContent)).toEqual(["Luis Herrera", "Marta Díaz"]);
    expect(screen.queryByText(/las agregaremos justo después de enviarla/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("add_participants without a ticket explains they will be added right after sending", () => {
    render(
      <ProposalCard {...base} proposal={{ kind: "add_participants", names: ["Luis Herrera"], ticket_ref: null }} />,
    );
    expect(screen.getByText(/las agregaremos justo después de enviarla/)).toBeTruthy();
  });

  it("update_ticket: shows before/after when known and only the new value otherwise", () => {
    render(
      <ProposalCard
        {...base}
        proposal={{ kind: "update_ticket", ticket_ref: "INC0001056", summary: "Red caída", urgency: "high" }}
        before={{ summary: "Red lenta" }}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Cambios propuestos" })).getAllByRole("listitem");
    expect(items[0]!.textContent).toBe("Resumen: Red lenta → Red caída");
    expect(items[1]!.textContent).toBe("Urgencia: No puedo trabajar");
  });

  it("close_ticket: confirms and dismisses through explicit buttons", () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ProposalCard
        {...base}
        proposal={{ kind: "close_ticket", ticket_ref: "INC0001056" }}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole("heading", { name: /Cerrar el ticket INC0001056/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("busy: the confirm button is disabled and aria-busy", () => {
    render(<ProposalCard {...base} status="busy" proposal={{ kind: "close_ticket", ticket_ref: "INC0001056" }} />);
    const button = screen.getByRole("button", { name: "Un momento…" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("done: announces the result as a status, shows amber notes and drops the actions", () => {
    render(
      <ProposalCard
        {...base}
        status="done"
        message="Agregué a Luis Herrera."
        notes={["No encontramos a Pepe.", "Hay más de una persona llamada Marta: Marta Díaz, Marta Ruiz."]}
        proposal={{ kind: "add_participants", names: ["Luis Herrera", "Pepe", "Marta"], ticket_ref: "INC0001056" }}
        ticketRef="INC0001056"
      />,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Agregué a Luis Herrera.");
    const notes = within(screen.getByRole("list", { name: "Para revisar" })).getAllByRole("listitem");
    expect(notes[0]!.className).toContain("tone-warning");
    expect(notes[0]!.querySelector("svg")).not.toBeNull();
    expect(notes[0]!.textContent).toContain("No encontramos a Pepe.");
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ahora no" })).toBeNull();
  });

  it("error: shows the backend message as an alert and keeps the actions for a retry", () => {
    render(
      <ProposalCard
        {...base}
        status="error"
        message="El ticket todavía no está resuelto."
        proposal={{ kind: "close_ticket", ticket_ref: "INC0001056" }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("El ticket todavía no está resuelto.");
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
  });
});
