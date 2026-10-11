import type { components } from "@/lib/api-types";
import {
  EMPTY_DRAFT,
  EMPTY_TOUCHED,
  mergeDraft,
  type DraftField,
  type DraftFields,
  type Touched,
} from "@/lib/merge-draft";

type Turn = components["schemas"]["AssistantTurn"];
type ReceiptIn = components["schemas"]["ReceiptIn"];
type UnavailableReason = components["schemas"]["HandoffResult"]["reason"];

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Entry = { kind: "new" | "ticket" | "service"; ref: string | null };
/** "requested" = the person pressed "Hablar con TI" / "Pasar con TI". */
export type DegradedReason = UnavailableReason | "requested";

export type ConversationState = {
  entry: Entry;
  messages: ChatMessage[];
  turn: Turn | null;
  draft: DraftFields;
  touched: Touched;
  busy: boolean;
  degraded: { reason: DegradedReason } | null;
  phase: "chat" | "confirm";
  submit: "idle" | "busy" | "error";
  idempotencyKey: string | null;
};

export type Action =
  | { type: "user-message"; text: string }
  | { type: "turn"; turn: Turn }
  | { type: "handoff"; reason: UnavailableReason }
  | { type: "request-it" }
  | { type: "edit"; field: DraftField; value: string | null }
  | { type: "review"; key: string }
  | { type: "back" }
  | { type: "submit-start" }
  | { type: "submit-fail" };

export function initialState(entry: Entry, greeting: string, draft: DraftFields = EMPTY_DRAFT): ConversationState {
  return {
    entry,
    messages: [{ role: "assistant", content: greeting }],
    turn: null,
    draft,
    touched: EMPTY_TOUCHED,
    busy: false,
    degraded: null,
    phase: "chat",
    submit: "idle",
    idempotencyKey: null,
  };
}

export function reducer(state: ConversationState, action: Action): ConversationState {
  switch (action.type) {
    case "user-message":
      return { ...state, messages: [...state.messages, { role: "user", content: action.text }], busy: true };
    case "turn": {
      // The person already asked for IT: the late answer must not rewrite their draft.
      if (state.degraded) return { ...state, busy: false };
      const suggestion: DraftFields = { ...EMPTY_DRAFT, ...action.turn.draft };
      return {
        ...state,
        busy: false,
        turn: action.turn,
        messages: [...state.messages, { role: "assistant", content: action.turn.message }],
        draft: mergeDraft(state.draft, suggestion, state.touched),
      };
    }
    case "handoff":
      return { ...state, busy: false, degraded: state.degraded ?? { reason: action.reason } };
    case "request-it":
      return { ...state, busy: false, degraded: { reason: "requested" } };
    case "edit":
      return {
        ...state,
        draft: { ...state.draft, [action.field]: action.value },
        touched: { ...state.touched, [action.field]: true },
      };
    case "review":
      return { ...state, phase: "confirm", submit: "idle", idempotencyKey: action.key };
    case "back":
      return { ...state, phase: "chat", submit: "idle" };
    case "submit-start":
      return { ...state, submit: "busy" };
    case "submit-fail":
      return { ...state, submit: "error" };
  }
}

/**
 * What still blocks the review, in form order. The Ariadna path needs every field; after a
 * handoff the person may send without impact/urgency, so those two are not reported then.
 */
export function missingFields(state: ConversationState): DraftField[] {
  const { service, summary, description, impact, urgency } = state.draft;
  const missing: DraftField[] = [];
  if (!service) missing.push("service");
  if (summary.trim() === "") missing.push("summary");
  if (description.trim() === "") missing.push("description");
  if (!state.degraded) {
    if (impact === null) missing.push("impact");
    if (urgency === null) missing.push("urgency");
  }
  return missing;
}

export function canReview(state: ConversationState): boolean {
  return missingFields(state).length === 0;
}

/** The receipt only exists for conversations Ariadna actually prepared (never after a handoff). */
export function receiptFrom(state: ConversationState): ReceiptIn | undefined {
  if (state.degraded || !state.turn) return undefined;
  const turn = state.turn;
  const understood = turn.understood || state.draft.summary;
  if (!understood.trim()) return undefined;
  return {
    understood,
    reviewed: turn.reviewed ?? [],
    not_done: [],
    permissions_notice: turn.permissions_notice ?? null,
    missing_data: turn.missing_data ?? [],
    target_group: turn.target_group ?? "",
  };
}
