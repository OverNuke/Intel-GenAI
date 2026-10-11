// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmStep, type ConfirmDraft } from "./confirm-step";

afterEach(cleanup);

const DRAFT: ConfirmDraft = {
  serviceLabel: "Impresión",
  summary: "La impresora no imprime",
  description: "Los documentos se quedan en la cola.",
  impact: "medium",
  urgency: "low",
  targetGroup: "Soporte de impresión",
};

describe("ConfirmStep (U6 confirmation)", () => {
  it("shows the whole draft and says plainly that pressing the button sends the ticket", () => {
    render(<ConfirmStep draft={DRAFT} requesterName="Ana Ruiz" status="idle" onConfirm={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Tu solicitud" })).toBeTruthy();
    expect(screen.getByText("La impresora no imprime")).toBeTruthy();
    expect(screen.getByText("Los documentos se quedan en la cola.")).toBeTruthy();
    expect(screen.getByText("Afecta a varias personas")).toBeTruthy();
    expect(screen.getByText("Puede esperar")).toBeTruthy();
    expect(screen.getByText("Soporte de impresión")).toBeTruthy();
    expect(screen.getByText("Ana Ruiz")).toBeTruthy();
    expect(screen.getByText(/Al presionar «Enviar solicitud», tu ticket se envía a TI/)).toBeTruthy();
  });

  it("sends only when the person presses the button, once", () => {
    const onConfirm = vi.fn();
    render(<ConfirmStep draft={DRAFT} requesterName="Ana Ruiz" status="idle" onConfirm={onConfirm} onBack={vi.fn()} />);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("while sending the button is busy and a second activation does nothing", () => {
    const onConfirm = vi.fn();
    render(<ConfirmStep draft={DRAFT} requesterName="Ana Ruiz" status="busy" onConfirm={onConfirm} onBack={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Enviando…" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("S-TS-8: on failure it keeps the draft visible, explains and allows retry", () => {
    const onConfirm = vi.fn();
    render(<ConfirmStep draft={DRAFT} requesterName="Ana Ruiz" status="error" onConfirm={onConfirm} onBack={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("No pudimos enviar tu solicitud");
    expect(screen.getByText("La impresora no imprime")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("'Atrás' goes back to the conversation", () => {
    const onBack = vi.fn();
    render(<ConfirmStep draft={DRAFT} requesterName="Ana Ruiz" status="idle" onConfirm={vi.fn()} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows the unknown-impact placeholders rather than blank values", () => {
    render(
      <ConfirmStep
        draft={{ ...DRAFT, impact: null, urgency: null, targetGroup: null, serviceLabel: null }}
        requesterName="Ana Ruiz"
        status="idle"
        onConfirm={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Por confirmar con TI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Por completar").length).toBe(2);
  });
});
