"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost, type PostBody } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { EMPTY_DRAFT, type DraftField, type DraftFields } from "@/lib/merge-draft";
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
} from "./conversation-reducer";
import { HandoffActions } from "./handoff-actions";
import { RequestDraftForm } from "./request-draft-form";
import { UnderstoodPanel } from "./understood-panel";

type User = components["schemas"]["UserOut"];
type Service = components["schemas"]["ServiceOut"];

const SUMMARY_ID = "u6-summary";
const FORM_ID = "u6-form";
const REASON_ID = "u6-review-reason";
const TOGGLE_ID = "u6-edit-toggle";

const FIELD_LABELS: Record<DraftField, string> = {
  service: COPY.chat.service,
  summary: COPY.request.summary,
  description: COPY.detail.description,
  impact: COPY.detail.impact,
  urgency: COPY.detail.urgency,
};

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

  async function confirm() {
    dispatch({ type: "submit-start" });
    const { service, summary, description, impact, urgency } = state.draft;
    const receipt = receiptFrom(state);
    const body: PostBody<"/api/tickets"> = {
      draft: { service: service ?? "", summary, description, impact, urgency },
      confirmed: true,
      ...(receipt ? { receipt } : {}),
      ...(state.idempotencyKey ? { idempotency_key: state.idempotencyKey } : {}),
    };
    const result = await apiPost("/api/tickets", body, doFetch);
    if (result.ok) {
      router.push(`/solicitud/enviada/${result.data.id}`);
      return;
    }
    dispatch({ type: "submit-fail" });
  }

  const selected = services.find((s) => s.key === state.draft.service);

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
              <UnderstoodPanel turn={state.degraded ? null : state.turn} />
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
