"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPatch, apiPost, type PatchBody, type PostBody } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { DRAFT_FIELD_LABELS, flagView } from "@/lib/flags";
import { EMPTY_DRAFT, type DraftField, type DraftFields } from "@/lib/merge-draft";
import { participantNotes } from "@/lib/participant-notes";
import { firstName } from "@/lib/ticket-labels";
import { Badge } from "../atoms/badge";
import { Button } from "../atoms/button";
import { Icon } from "../atoms/icon";
import { Chat } from "./chat";
import { ConfirmStep } from "./confirm-step";
import {
  canReview,
  initialState,
  missingFields,
  receiptFrom,
  reducer,
  type Entry,
  type ProposalState,
} from "./conversation-reducer";
import { HandoffActions } from "./handoff-actions";
import { ProposalCard } from "./proposal-card";
import { RequestDraftForm } from "./request-draft-form";
import { UnderstoodPanel } from "./understood-panel";

type User = components["schemas"]["UserOut"];
type Service = components["schemas"]["ServiceOut"];

const SUMMARY_ID = "u6-summary";
const FORM_ID = "u6-form";
const REASON_ID = "u6-review-reason";
const TOGGLE_ID = "u6-edit-toggle";

const FIELD_LABELS = DRAFT_FIELD_LABELS;
const P = COPY.chat.proposal;

/** Backend `{reason, message}` bodies carry plain-language text: show it as-is. */
function failureMessage(status: number, error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  if (status === 404) return P.errors.notFound;
  if (status === 401) return P.errors.session;
  return P.errors.generic;
}

const MAX_HISTORY = 20;
const MAX_CHARS = 2000;
const DEFAULT_TIMEOUT_MS = 55_000; // below the platform function limit (backend LLM timeout is 20s)

function greeting(entry: Entry, user: User, services: Service[]): string {
  if (entry.kind === "ticket" && entry.ref) {
    return `Veo el ticket ${entry.ref}. ¿Qué necesitas saber o agregar?`;
  }
  if (entry.kind === "service") {
    const label = services.find((s) => s.key === entry.ref)?.label ?? entry.ref ?? "";
    return `Elegiste «${label}». ¿Qué está pasando?`;
  }
  return `Hola, ${firstName(user.name)}. Cuéntame qué está pasando y te ayudo a preparar tu solicitud.`;
}

export type ConversationContainerProps = {
  user: User;
  entry: Entry;
  services: Service[];
  /** Summary of the ticket when the help was opened from U3 (display only). */
  ticketSummary: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  newKey?: () => string;
};

/** U6 container: owns the reducer, talks to the API and navigates to U7 after a human submit. */
export function ConversationContainer({
  user,
  entry,
  services,
  ticketSummary,
  fetchImpl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  newKey = () => crypto.randomUUID(),
}: ConversationContainerProps) {
  const router = useRouter();
  const doFetch: typeof fetch = fetchImpl ?? ((...args) => fetch(...args));
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const draft: DraftFields = {
      ...EMPTY_DRAFT,
      service: entry.kind === "service" ? entry.ref : null,
    };
    return initialState(entry, greeting(entry, user, services), draft);
  });
  const inflight = useRef<AbortController | null>(null);
  // Which U6 panel the left column shows; the form is mounted either way (only `hidden` toggles).
  const [panel, setPanel] = useState<"summary" | "form">("summary");
  // "Completar en el formulario": a fresh object per request so it also works with the form open.
  const [focusRequest, setFocusRequest] = useState<{ field: DraftField } | null>(null);

  useEffect(() => {
    if (!focusRequest) return;
    const { field } = focusRequest;
    const target =
      field === "service"
        ? document.getElementById("f-service")
        : field === "summary"
          ? document.getElementById("f-summary")
          : field === "description"
            ? document.getElementById("f-desc")
            : (document.querySelector<HTMLInputElement>(`#${field}-group input:checked`) ??
              document.querySelector<HTMLInputElement>(`#${field}-group input[type="radio"]`));
    target?.focus();
  }, [focusRequest]);

  async function send(text: string) {
    dispatch({ type: "user-message", text });
    const history = [...state.messages, { role: "user" as const, content: text }]
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    const controller = new AbortController();
    inflight.current = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const result = await apiPost(
      "/api/assistant/turn",
      {
        entry: state.entry.ref ? { kind: state.entry.kind, ref: state.entry.ref } : { kind: state.entry.kind },
        history,
        draft: {
          service: state.draft.service,
          summary: state.draft.summary,
          description: state.draft.description,
          impact: state.draft.impact,
          urgency: state.draft.urgency,
        },
      },
      doFetch,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (inflight.current === controller) inflight.current = null;
    if (!result.ok) {
      dispatch({ type: "handoff", reason: controller.signal.aborted ? "timeout" : "connection_error" });
    } else if (result.data.kind === "handoff") {
      dispatch({ type: "handoff", reason: result.data.reason });
    } else {
      dispatch({ type: "turn", turn: result.data.turn });
    }
  }

  function requestIt() {
    inflight.current?.abort();
    dispatch({ type: "request-it" });
    // REQ-AC-14: with a sendable draft the person lands on the confirmation straight away;
    // otherwise they stay here with the draft editable until it can be reviewed.
    if (canReview({ ...state, degraded: { reason: "requested" } })) {
      dispatch({ type: "review", key: newKey() });
    }
  }

  async function confirm(key?: string) {
    dispatch({ type: "submit-start", ...(key ? { key } : {}) });
    const { service, summary, description, impact, urgency } = state.draft;
    const receipt = receiptFrom(state);
    const body: PostBody<"/api/tickets"> = {
      draft: { service: service ?? "", summary, description, impact, urgency },
      confirmed: true,
      ...(receipt ? { receipt } : {}),
      ...((state.idempotencyKey ?? key) ? { idempotency_key: (state.idempotencyKey ?? key) as string } : {}),
    };
    const result = await apiPost("/api/tickets", body, doFetch);
    if (!result.ok) {
      dispatch({ type: "submit-fail" });
      return;
    }
    const id = result.data.id;
    if (state.queuedParticipants.length === 0) {
      router.push(`/solicitud/enviada/${id}`);
      return;
    }
    // The person already confirmed these names on their card; the ticket exists now.
    const added = await apiPost(
      "/api/tickets/{display_id}/participants",
      { names: state.queuedParticipants, confirmed: true },
      doFetch,
      { params: { display_id: id } },
    );
    const notes = added.ok ? participantNotes(added.data) : [];
    if (added.ok && notes.length === 0) {
      router.push(`/solicitud/enviada/${id}`);
      return;
    }
    // The ticket stays sent; keep the person here so the amber notice is not lost on navigation.
    dispatch({
      type: "sent",
      id,
      notices: added.ok ? [P.participants.afterSendPartial, ...notes] : [P.participants.afterSendFailed],
    });
  }

  async function confirmProposal(item: ProposalState) {
    const { proposal } = item;
    if (proposal.kind === "create_ticket") {
      void confirm(state.idempotencyKey ?? newKey());
      return;
    }
    if (proposal.kind === "add_participants") {
      const ref = proposal.ticket_ref ?? (entry.kind === "ticket" ? entry.ref : null);
      if (!ref) {
        dispatch({ type: "participants-queued", id: item.id, message: P.participants.queuedDone });
        return;
      }
      dispatch({ type: "proposal-start", id: item.id });
      const result = await apiPost(
        "/api/tickets/{display_id}/participants",
        { names: proposal.names, confirmed: true },
        doFetch,
        { params: { display_id: ref } },
      );
      if (!result.ok) {
        dispatch({ type: "proposal-fail", id: item.id, message: failureMessage(result.status, result.error) });
        return;
      }
      const { added } = result.data;
      dispatch({
        type: "proposal-done",
        id: item.id,
        message: added.length > 0 ? `${P.participants.added} ${added.join(", ")}.` : P.participants.none,
        notes: participantNotes(result.data),
      });
      return;
    }
    dispatch({ type: "proposal-start", id: item.id });
    if (proposal.kind === "close_ticket") {
      const result = await apiPost(
        "/api/tickets/{display_id}/close",
        { confirmed: true },
        doFetch,
        { params: { display_id: proposal.ticket_ref } },
      );
      dispatch(
        result.ok
          ? { type: "proposal-done", id: item.id, message: `${P.close.done} ${proposal.ticket_ref}.` }
          : { type: "proposal-fail", id: item.id, message: failureMessage(result.status, result.error) },
      );
      return;
    }
    const changes: PatchBody<"/api/tickets/{display_id}"> = { confirmed: true };
    if (proposal.summary != null) changes.summary = proposal.summary;
    if (proposal.description != null) changes.description = proposal.description;
    if (proposal.impact != null) changes.impact = proposal.impact;
    if (proposal.urgency != null) changes.urgency = proposal.urgency;
    const result = await apiPatch("/api/tickets/{display_id}", changes, doFetch, {
      params: { display_id: proposal.ticket_ref },
    });
    dispatch(
      result.ok
        ? { type: "proposal-done", id: item.id, message: `${P.update.done} ${proposal.ticket_ref}.` }
        : { type: "proposal-fail", id: item.id, message: failureMessage(result.status, result.error) },
    );
  }

  const selected = services.find((s) => s.key === state.draft.service);

  if (state.sent) {
    return (
      <div className="stack">
        <h1 tabIndex={-1}>{COPY.chat.sentTitle}</h1>
        <p role="status">{COPY.request.sentBody}</p>
        {state.sent.notices.map((notice) => (
          <div key={notice} className="alert tone-warning">
            <Icon name="triangle-alert" />
            <p>{notice}</p>
          </div>
        ))}
        <div className="actions">
          <Link className="btn btn-primary" href={`/solicitud/enviada/${state.sent.id}`}>
            {COPY.request.seeTicket}
          </Link>
        </div>
      </div>
    );
  }

  if (state.phase === "confirm") {
    return (
      <div className="stack">
        <h1 tabIndex={-1}>{COPY.chat.title}</h1>
        <ConfirmStep
          draft={{
            serviceLabel: selected?.label ?? null,
            summary: state.draft.summary,
            description: state.draft.description,
            impact: state.draft.impact,
            urgency: state.draft.urgency,
            targetGroup: state.turn?.target_group ?? selected?.handled_by ?? null,
          }}
          requesterName={user.name}
          status={state.submit}
          onConfirm={() => void confirm()}
          onBack={() => dispatch({ type: "back" })}
        />
      </div>
    );
  }

  const missing = missingFields(state);
  const reviewable = missing.length === 0;
  const flags = flagView({ flags: state.turn?.flags ?? [], missing, edited: state.editedSinceTurn });
  const draftSummary = {
    serviceLabel: selected?.label ?? null,
    summary: state.draft.summary,
    description: state.draft.description,
    impact: state.draft.impact ? COPY.impact[state.draft.impact] : null,
    urgency: state.draft.urgency ? COPY.urgency[state.draft.urgency] : null,
  };
  const formOpen = panel === "form";
  const backHref = entry.kind === "ticket" && entry.ref ? `/tickets/${entry.ref}` : "/inicio";

  function openForm(field: DraftField) {
    setPanel("form");
    setFocusRequest({ field });
  }

  function closeForm() {
    setPanel("summary");
    document.getElementById(TOGGLE_ID)?.focus();
  }

  return (
    <div className="conv-page">
      <div className="chat-head">
        <Link className="btn btn-ghost" href={backHref}>
          <Icon name="arrow-left" />
          {COPY.chat.back}
        </Link>
        <h1 tabIndex={-1}>{COPY.chat.title}</h1>
        <Badge>{COPY.sampleData}</Badge>
      </div>
      <div className="conversation-grid">
        <div className="conv-side">
          {/* Swap region: both panels stay mounted (draft + a11y tree); `hidden` picks one. */}
          <div className="conv-panels">
            <div id={SUMMARY_ID} className="conv-panel" hidden={formOpen}>
              <UnderstoodPanel turn={state.degraded ? null : state.turn} {...(state.degraded ? {} : { flags })} />
            </div>
            <div id={FORM_ID} className="conv-panel stack" hidden={!formOpen}>
              <div>
                <Button variant="ghost" onClick={closeForm}>
                  <Icon name="arrow-left" />
                  {COPY.chat.backToSummary}
                </Button>
              </div>
              <RequestDraftForm
                draft={state.draft}
                touched={state.touched}
                services={services}
                requesterName={user.name}
                onEdit={(field, value) => dispatch({ type: "edit", field, value })}
              />
            </div>
          </div>
          {/* Proposals sit outside the toggled region too, so a pending one is never hidden. */}
          {state.degraded || state.proposals.length === 0 ? null : (
            <section aria-label={COPY.chat.proposalsLabel} className="stack">
              {state.proposals.map((item) => {
                const isCreate = item.proposal.kind === "create_ticket";
                const ref =
                  item.proposal.kind === "add_participants"
                    ? (item.proposal.ticket_ref ?? (entry.kind === "ticket" ? entry.ref : null))
                    : item.proposal.kind === "create_ticket"
                      ? null
                      : item.proposal.ticket_ref;
                const knownBefore =
                  item.proposal.kind === "update_ticket" &&
                  entry.kind === "ticket" &&
                  entry.ref === item.proposal.ticket_ref &&
                  ticketSummary
                    ? { summary: ticketSummary }
                    : {};
                return (
                  <ProposalCard
                    key={item.id}
                    proposal={item.proposal}
                    status={isCreate ? (state.submit === "busy" ? "busy" : state.submit === "error" ? "error" : "idle") : item.status}
                    message={isCreate ? (state.submit === "error" ? P.create.failed : null) : item.message}
                    notes={item.notes}
                    ticketRef={ref}
                    before={knownBefore}
                    draft={isCreate ? draftSummary : null}
                    blocked={isCreate && !reviewable}
                    onConfirm={() => void confirmProposal(item)}
                    onDismiss={() => dispatch({ type: "proposal-dismiss", id: item.id })}
                  />
                );
              })}
            </section>
          )}
          {/* Footer sits OUTSIDE the toggled region so the actions never disappear with it. */}
          <div className="conv-actions">
            {reviewable ? null : (
              <>
                <p id={REASON_ID} className="t-meta">
                  {`${COPY.chat.reviewMissing}: ${missing.map((field) => FIELD_LABELS[field]).join(", ")}`}
                </p>
                <Button variant="secondary" onClick={() => openForm(missing[0]!)}>
                  <Icon name="pencil" />
                  {COPY.chat.openForm}
                </Button>
              </>
            )}
            <div className="actions">
              <Button
                disabled={!reviewable}
                aria-describedby={reviewable ? undefined : REASON_ID}
                onClick={() => dispatch({ type: "review", key: newKey() })}
              >
                {COPY.chat.review}
              </Button>
              <Button
                id={TOGGLE_ID}
                variant="ghost"
                aria-expanded={formOpen}
                aria-controls={FORM_ID}
                onClick={() => setPanel(formOpen ? "summary" : "form")}
              >
                <Icon name={formOpen ? "minimize-2" : "maximize-2"} />
                {COPY.chat.editRequest}
              </Button>
            </div>
          </div>
        </div>
        <Chat
          messages={state.messages}
          busy={state.busy}
          onSend={(text) => void send(text)}
          footer={<HandoffActions onHandoff={requestIt} active={state.degraded !== null} />}
        />
      </div>
    </div>
  );
}
