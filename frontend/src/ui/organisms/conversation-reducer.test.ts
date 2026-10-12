import { describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { canReview, initialState, missingFields, receiptFrom, reducer } from "./conversation-reducer";

type Turn = components["schemas"]["AssistantTurn"];

const turn = (over: Partial<Turn> = {}): Turn => ({
  message: "¿A cuántas personas afecta?",
  understood: "La impresora no imprime.",
  reviewed: ["Destino sugerido: Soporte de impresión"],
  draft: { service: "printing", summary: "Impresora sin imprimir", description: "No imprime", impact: null, urgency: null },
  missing_data: ["Impacto"],
  target_group: "Soporte de impresión",
  needs_authorization: false,
  permissions_notice: null,
  ready: false,
  ...over,
});

const start = () => initialState({ kind: "new", ref: null }, "Hola, Ana. Cuéntame qué está pasando.");

describe("conversation reducer", () => {
  it("starts with the assistant greeting, an empty draft and nothing busy", () => {
    const state = start();
    expect(state.messages).toEqual([{ role: "assistant", content: "Hola, Ana. Cuéntame qué está pasando." }]);
    expect(state.busy).toBe(false);
    expect(state.phase).toBe("chat");
    expect(state.degraded).toBeNull();
  });

  it("a user message is appended and marks the conversation busy", () => {
    const state = reducer(start(), { type: "user-message", text: "La impresora no imprime" });
    expect(state.messages.at(-1)).toEqual({ role: "user", content: "La impresora no imprime" });
    expect(state.busy).toBe(true);
  });

  it("a turn adds the assistant message, fills the draft and stores the turn", () => {
    let state = reducer(start(), { type: "user-message", text: "La impresora no imprime" });
    state = reducer(state, { type: "turn", turn: turn() });
    expect(state.busy).toBe(false);
    expect(state.messages.at(-1)).toEqual({ role: "assistant", content: "¿A cuántas personas afecta?" });
    expect(state.draft.summary).toBe("Impresora sin imprimir");
    expect(state.turn?.missing_data).toEqual(["Impacto"]);
  });

  it("S-AC-10: an edited field is touched and survives the next turn", () => {
    let state = reducer(start(), { type: "edit", field: "summary", value: "Mi título" });
    state = reducer(state, { type: "user-message", text: "hola" });
    state = reducer(state, { type: "turn", turn: turn() });
    expect(state.draft.summary).toBe("Mi título");
    expect(state.draft.description).toBe("No imprime");
    expect(state.touched.summary).toBe(true);
  });

  it("S-AC-11: a handoff keeps the draft editable and records the reason", () => {
    let state = reducer(start(), { type: "edit", field: "description", value: "Texto mío" });
    state = reducer(state, { type: "user-message", text: "x" });
    state = reducer(state, { type: "handoff", reason: "rate_limited" });
    expect(state.degraded).toEqual({ reason: "rate_limited" });
    expect(state.busy).toBe(false);
    expect(state.draft.description).toBe("Texto mío");
    state = reducer(state, { type: "edit", field: "summary", value: "Aún puedo editar" });
    expect(state.draft.summary).toBe("Aún puedo editar");
  });

  it("the user can ask for IT at any time (also while busy)", () => {
    const busy = reducer(start(), { type: "user-message", text: "x" });
    const state = reducer(busy, { type: "request-it" });
    expect(state.degraded).toEqual({ reason: "requested" });
    expect(state.busy).toBe(false);
  });

  it("a turn that arrives after the user asked for IT is ignored", () => {
    let state = reducer(start(), { type: "user-message", text: "x" });
    state = reducer(state, { type: "request-it" });
    const after = reducer(state, { type: "turn", turn: turn() });
    expect(after.turn).toBeNull();
    expect(after.messages).toEqual(state.messages);
  });

  it("review moves to the confirmation step with a fresh idempotency key; back returns", () => {
    let state = reducer(start(), { type: "review", key: "key-1" });
    expect(state.phase).toBe("confirm");
    expect(state.submit).toBe("idle");
    expect(state.idempotencyKey).toBe("key-1");
    state = reducer(state, { type: "back" });
    expect(state.phase).toBe("chat");
  });

  it("submit start/fail keeps the draft and the same key for the retry", () => {
    let state = reducer(start(), { type: "edit", field: "summary", value: "Algo" });
    state = reducer(state, { type: "review", key: "key-1" });
    state = reducer(state, { type: "submit-start" });
    expect(state.submit).toBe("busy");
    state = reducer(state, { type: "submit-fail" });
    expect(state.submit).toBe("error");
    expect(state.draft.summary).toBe("Algo");
    expect(state.idempotencyKey).toBe("key-1");
  });
});

describe("canReview and receiptFrom", () => {
  const filled = {
    service: "printing",
    summary: "Resumen",
    description: "Descripción",
    impact: "low" as const,
    urgency: "low" as const,
  };

  it("needs service, summary, description, impact and urgency on the Ariadna path", () => {
    expect(canReview({ ...start(), draft: filled })).toBe(true);
    expect(canReview({ ...start(), draft: { ...filled, impact: null } })).toBe(false);
    expect(canReview({ ...start(), draft: { ...filled, summary: "  " } })).toBe(false);
  });

  it("after a handoff impact and urgency are optional (service, summary, description remain)", () => {
    const degraded = { ...start(), degraded: { reason: "timeout" as const }, draft: { ...filled, impact: null, urgency: null } };
    expect(canReview(degraded)).toBe(true);
    expect(canReview({ ...degraded, draft: { ...degraded.draft, service: null } })).toBe(false);
  });

  it("missingFields lists what blocks the review in form order and agrees with canReview", () => {
    expect(missingFields(start())).toEqual(["service", "summary", "description", "impact", "urgency"]);
    expect(missingFields({ ...start(), draft: { ...filled, summary: "  ", impact: null } })).toEqual(["summary", "impact"]);
    expect(missingFields({ ...start(), draft: filled })).toEqual([]);
    const cases = [
      start(),
      { ...start(), draft: filled },
      { ...start(), draft: { ...filled, urgency: null } },
      { ...start(), draft: { ...filled, description: "" } },
      { ...start(), degraded: { reason: "requested" as const }, draft: { ...filled, impact: null, urgency: null } },
      { ...start(), degraded: { reason: "requested" as const }, draft: { ...filled, service: null } },
    ];
    for (const state of cases) expect(canReview(state)).toBe(missingFields(state).length === 0);
  });

  it("missingFields drops impact and urgency once degraded (they become optional)", () => {
    const degraded = { ...start(), degraded: { reason: "timeout" as const }, draft: { ...filled, service: null, impact: null, urgency: null } };
    expect(missingFields(degraded)).toEqual(["service"]);
  });

  it("builds the receipt from the latest turn and omits it once degraded", () => {
    const state = { ...start(), turn: turn({ permissions_notice: "Falta autorización" }) };
    expect(receiptFrom(state)).toEqual({
      understood: "La impresora no imprime.",
      reviewed: ["Destino sugerido: Soporte de impresión"],
      not_done: [],
      permissions_notice: "Falta autorización",
      missing_data: ["Impacto"],
      target_group: "Soporte de impresión",
    });
    expect(receiptFrom({ ...state, degraded: { reason: "requested" } })).toBeUndefined();
    expect(receiptFrom(start())).toBeUndefined();
  });
});

describe("proposals, edits since the turn and queued participants (agent v2)", () => {
  const addTwo = { kind: "add_participants" as const, names: ["Luis Herrera", "Marta Díaz"], ticket_ref: null };
  const close = { kind: "close_ticket" as const, ticket_ref: "INC0001056" };

  it("a turn replaces the proposals with fresh idle cards and resets the edits since the turn", () => {
    let state = reducer(start(), { type: "edit", field: "impact", value: "low" });
    expect(state.editedSinceTurn).toEqual(["impact"]);
    state = reducer(state, { type: "turn", turn: turn({ proposals: [addTwo] }) });
    expect(state.editedSinceTurn).toEqual([]);
    expect(state.proposals).toHaveLength(1);
    expect(state.proposals[0]).toMatchObject({ proposal: addTwo, status: "idle", message: null, notes: [] });
    state = reducer(state, { type: "turn", turn: turn({ proposals: [] }) });
    expect(state.proposals).toEqual([]);
  });

  it("a turn without the new fields (old payload) yields no proposals", () => {
    const state = reducer(start(), { type: "turn", turn: turn() });
    expect(state.proposals).toEqual([]);
  });

  it("walks a proposal idle -> busy -> done and never shows a confirmed one again", () => {
    let state = reducer(start(), { type: "turn", turn: turn({ proposals: [close] }) });
    const id = state.proposals[0]!.id;
    state = reducer(state, { type: "proposal-start", id });
    expect(state.proposals[0]!.status).toBe("busy");
    state = reducer(state, { type: "proposal-done", id, message: "Listo", notes: ["nota"] });
    expect(state.proposals[0]).toMatchObject({ status: "done", message: "Listo", notes: ["nota"] });
    state = reducer(state, { type: "turn", turn: turn({ proposals: [close] }) });
    expect(state.proposals).toEqual([]);
  });

  it("an error keeps the card with the backend message and lets the person retry", () => {
    let state = reducer(start(), { type: "turn", turn: turn({ proposals: [close] }) });
    const id = state.proposals[0]!.id;
    state = reducer(state, { type: "proposal-start", id });
    state = reducer(state, { type: "proposal-fail", id, message: "Todavía no está resuelto." });
    expect(state.proposals[0]).toMatchObject({ status: "error", message: "Todavía no está resuelto." });
    state = reducer(state, { type: "proposal-start", id });
    expect(state.proposals[0]).toMatchObject({ status: "busy", message: null });
  });

  it("Ahora no removes the card without confirming it", () => {
    let state = reducer(start(), { type: "turn", turn: turn({ proposals: [close] }) });
    state = reducer(state, { type: "proposal-dismiss", id: state.proposals[0]!.id });
    expect(state.proposals).toEqual([]);
    state = reducer(state, { type: "turn", turn: turn({ proposals: [close] }) });
    expect(state.proposals).toHaveLength(1);
  });

  it("queues participant names for the not-yet-sent request, deduplicated", () => {
    let state = reducer(start(), { type: "turn", turn: turn({ proposals: [addTwo] }) });
    const id = state.proposals[0]!.id;
    state = reducer(state, { type: "participants-queued", id, message: "Listo" });
    expect(state.queuedParticipants).toEqual(["Luis Herrera", "Marta Díaz"]);
    expect(state.proposals[0]!.status).toBe("done");
    const more = { ...addTwo, names: ["Marta Díaz", "Pedro Soto"] };
    state = reducer(state, { type: "turn", turn: turn({ proposals: [more] }) });
    state = reducer(state, { type: "participants-queued", id: state.proposals[0]!.id, message: "Listo" });
    expect(state.queuedParticipants).toEqual(["Luis Herrera", "Marta Díaz", "Pedro Soto"]);
  });

  it("submit-start can carry the idempotency key and keeps the first one", () => {
    let state = reducer(start(), { type: "submit-start", key: "k-9" });
    expect(state.submit).toBe("busy");
    expect(state.idempotencyKey).toBe("k-9");
    state = reducer(state, { type: "submit-start", key: "k-10" });
    expect(state.idempotencyKey).toBe("k-9");
  });

  it("records a sent ticket with its notices (participants failed after the send)", () => {
    const state = reducer(start(), { type: "sent", id: "INC0001061", notices: ["No encontramos a Pepe."] });
    expect(state.sent).toEqual({ id: "INC0001061", notices: ["No encontramos a Pepe."] });
  });
});
