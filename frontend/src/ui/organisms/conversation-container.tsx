"use client";

import { useReducer, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost, type PostBody } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { EMPTY_DRAFT, type DraftFields } from "@/lib/merge-draft";
import { firstName } from "@/lib/ticket-labels";
import { Badge } from "../atoms/badge";
import { Button } from "../atoms/button";
import { Icon } from "../atoms/icon";
import { Chat } from "./chat";
import { ConfirmStep } from "./confirm-step";
import {
  canReview,
  initialState,
  receiptFrom,
  reducer,
  type Entry,
} from "./conversation-reducer";
import { HandoffActions } from "./handoff-actions";
import { RequestDraftForm } from "./request-draft-form";
import { UnderstoodPanel } from "./understood-panel";

type User = components["schemas"]["UserOut"];
type Service = components["schemas"]["ServiceOut"];

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

  const reviewable = canReview(state);
  const backHref = entry.kind === "ticket" && entry.ref ? `/tickets/${entry.ref}` : "/inicio";
  return (
    <div className="stack">
      <div className="chat-head">
        <Link className="btn btn-ghost" href={backHref}>
          <Icon name="arrow-left" />
          {COPY.chat.back}
        </Link>
        <h1 tabIndex={-1}>{COPY.chat.title}</h1>
        <Badge>{COPY.sampleData}</Badge>
        <div className="chat-head-actions">
          <HandoffActions onHandoff={requestIt} active={state.degraded !== null} />
        </div>
      </div>
      <div className="conversation-grid">
        <div className="stack">
          <Chat messages={state.messages} busy={state.busy} onSend={(text) => void send(text)} />
          <UnderstoodPanel turn={state.degraded ? null : state.turn} />
        </div>
        <div className="stack">
          <RequestDraftForm
            draft={state.draft}
            touched={state.touched}
            services={services}
            requesterName={user.name}
            onEdit={(field, value) => dispatch({ type: "edit", field, value })}
          />
          {reviewable ? null : <p className="t-meta">{COPY.chat.reviewHelp}</p>}
          <div className="actions">
            <Button
              disabled={!reviewable}
              onClick={() => dispatch({ type: "review", key: newKey() })}
            >
              {COPY.chat.review}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
