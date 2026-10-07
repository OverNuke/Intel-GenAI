import { describe, expect, it } from "vitest";
import { submitTicket, type TicketDraft } from "./submit-ticket";

const draft: TicketDraft = {
  requesterId: "ana",
  service: "network",
  summary: "Nodo de red para teléfono IP nuevo",
  description: "Contabilidad necesita un nodo en la oficina 3.",
};

describe("submitTicket — el humano confirma", () => {
  it("rechaza el envío sin confirmación explícita de una persona", () => {
    const result = submitTicket(draft, undefined);
    expect(result).toEqual({ ok: false, reason: "missing-human-confirmation" });
  });

  it("rechaza una confirmación hecha por el asistente", () => {
    const result = submitTicket(draft, { by: "assistant", requesterId: "ana" });
    expect(result).toEqual({ ok: false, reason: "missing-human-confirmation" });
  });

  it("rechaza la confirmación de otra persona distinta del solicitante", () => {
    const result = submitTicket(draft, { by: "human", requesterId: "luis" });
    expect(result).toEqual({ ok: false, reason: "confirmation-not-from-requester" });
  });

  it("rechaza un borrador incompleto aunque haya confirmación", () => {
    const result = submitTicket(
      { ...draft, summary: "  " },
      { by: "human", requesterId: "ana" },
    );
    expect(result).toEqual({ ok: false, reason: "incomplete-draft" });
  });

  it("envía cuando el solicitante confirma un borrador completo", () => {
    const result = submitTicket(draft, { by: "human", requesterId: "ana" });
    expect(result).toEqual({
      ok: true,
      ticket: { ...draft, status: "new" },
    });
  });
});
