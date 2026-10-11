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

type Proposal = NonNullable<Turn["proposals"]>[number];

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Entry = { kind: "new" | "ticket" | "service"; ref: string | null };
/** "requested" = the person pressed "Hablar con TI" / "Pasar con TI". */
export type DegradedReason = UnavailableReason | "requested";

export type ProposalStatus = "idle" | "busy" | "done" | "error";
export type ProposalState = {
  /** Unique within the current turn. */
  id: string;
  /** Content identity, so a confirmed proposal the model repeats is not shown again. */
  signature: string;
  proposal: Proposal;
  status: ProposalStatus;
  /** Result (done) or backend message (error). */
  message: string | null;
  /** Amber follow-ups: ambiguous / unknown names. */
  notes: string[];
};

export function proposalSignature(proposal: Proposal): string {
  return JSON.stringify(proposal);
}

export type SentTicket = { id: string; notices: string[] };

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
  /** Agent v2: what Ariadna proposes (never executed without a click). */
  proposals: ProposalState[];
  confirmedProposals: string[];
  /** Names to add right after the not-yet-sent request is submitted. */
  queuedParticipants: string[];
  /** Draft fields the person edited since the last turn (server warnings about them are stale). */
  editedSinceTurn: DraftField[];
  /** Set only when the ticket was sent but something after the send needs the person's attention. */
  sent: SentTicket | null;
};

export type Action =
  | { type: "user-message"; text: string }
  | { type: "turn"; turn: Turn }
  | { type: "handoff"; reason: UnavailableReason }
  | { type: "request-it" }
  | { type: "edit"; field: DraftField; value: string | null }
  | { type: "review"; key: string }
  | { type: "back" }
  | { type: "submit-start"; key?: string }
  | { type: "submit-fail" }
  | { type: "proposal-start"; id: string }
  | { type: "proposal-done"; id: string; message: string; notes?: string[] }
  | { type: "proposal-fail"; id: string; message: string }
  | { type: "proposal-dismiss"; id: string }
  | { type: "participants-queued"; id: string; message: string }
  | { type: "sent"; id: string; notices: string[] };

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
    proposals: [],
    confirmedProposals: [],
    queuedParticipants: [],
    editedSinceTurn: [],
    sent: null,
  };
}

function patchProposal(state: ConversationState, id: string, patch: Partial<ProposalState>): ConversationState {
  return { ...state, proposals: state.proposals.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

function confirmedWith(state: ConversationState, id: string): string[] {
  const found = state.proposals.find((p) => p.id === id);
  return found ? [...state.confirmedProposals, found.signature] : state.confirmedProposals;
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
        editedSinceTurn: [],
        proposals: (action.turn.proposals ?? [])
          .map((proposal, index) => ({ proposal, signature: proposalSignature(proposal), index }))
          .filter((p) => !state.confirmedProposals.includes(p.signature))
          .map(
            (p): ProposalState => ({
              id: `p${state.messages.length}-${p.index}`,
              signature: p.signature,
              proposal: p.proposal,
              status: "idle",
              message: null,
              notes: [],
            }),
          ),
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
        editedSinceTurn: state.editedSinceTurn.includes(action.field)
          ? state.editedSinceTurn
          : [...state.editedSinceTurn, action.field],
      };
    case "review":
      return { ...state, phase: "confirm", submit: "idle", idempotencyKey: action.key };
    case "back":
      return { ...state, phase: "chat", submit: "idle" };
    case "submit-start":
      return { ...state, submit: "busy", idempotencyKey: state.idempotencyKey ?? action.key ?? null };
    case "submit-fail":
      return { ...state, submit: "error" };
    case "proposal-start":
      return patchProposal(state, action.id, { status: "busy", message: null, notes: [] });
    case "proposal-done":
      return {
        ...patchProposal(state, action.id, { status: "done", message: action.message, notes: action.notes ?? [] }),
        confirmedProposals: confirmedWith(state, action.id),
      };
    case "proposal-fail":
      return patchProposal(state, action.id, { status: "error", message: action.message });
    case "proposal-dismiss":
      return { ...state, proposals: state.proposals.filter((p) => p.id !== action.id) };
    case "participants-queued": {
      const found = state.proposals.find((p) => p.id === action.id);
      const names = found?.proposal.kind === "add_participants" ? found.proposal.names : [];
      const queued = [...state.queuedParticipants];
      for (const name of names) if (!queued.includes(name)) queued.push(name);
      return {
        ...patchProposal(state, action.id, { status: "done", message: action.message, notes: [] }),
        queuedParticipants: queued,
        confirmedProposals: confirmedWith(state, action.id),
      };
    }
    case "sent":
      return { ...state, submit: "idle", sent: { id: action.id, notices: action.notices } };
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
