"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { Button } from "../atoms/button";
import { Icon } from "../atoms/icon";
import type { ProposalStatus } from "./conversation-reducer";

type Proposal = NonNullable<components["schemas"]["AssistantTurn"]["proposals"]>[number];

const P = COPY.chat.proposal;

export type DraftSummary = {
  serviceLabel: string | null;
  summary: string;
  description: string;
  impact: string | null;
  urgency: string | null;
};

export type ProposalCardProps = {
  proposal: Proposal;
  status: ProposalStatus;
  /** Result text (done) or backend message (error). */
  message: string | null;
  /** Amber follow-ups under the result. */
  notes: string[];
  /** Ticket the action applies to, when known. */
  ticketRef: string | null;
  /** Known current values for `update_ticket`, keyed by field, already in plain language. */
  before: Partial<Record<UpdateField, string>>;
  /** `create_ticket` only: the draft in plain language. */
  draft: DraftSummary | null;
  /** `create_ticket` only: blocking items exist. */
  blocked: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

type UpdateField = "summary" | "description" | "impact" | "urgency";
const UPDATE_FIELDS: UpdateField[] = ["summary", "description", "impact", "urgency"];

function title(proposal: Proposal, ticketRef: string | null): string {
  switch (proposal.kind) {
    case "create_ticket":
      return P.create.title;
    case "add_participants":
      return ticketRef ? `${P.participants.title} ${ticketRef}` : P.participants.titleNew;
    case "update_ticket":
      return `${P.update.title} ${proposal.ticket_ref}`;
    case "close_ticket":
      return `${P.close.title} ${proposal.ticket_ref}`;
  }
}

/** Plain-language value of a proposed field change. */
function changeValue(field: UpdateField, value: string): string {
  if (field === "impact") return COPY.impact[value as keyof typeof COPY.impact] ?? value;
  if (field === "urgency") return COPY.urgency[value as keyof typeof COPY.urgency] ?? value;
  return value;
}

/**
 * One proposal from Ariadna. Presentational: it only reports clicks. A proposal never runs by
 * itself; the person presses "Confirmar" (or "Ahora no").
 */
export function ProposalCard({
  proposal,
  status,
  message,
  notes,
  ticketRef,
  before,
  draft,
  blocked,
  onConfirm,
  onDismiss,
}: ProposalCardProps) {
  const headingId = `proposal-${proposal.kind}-title`;
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Move focus to the outcome so keyboard and screen-reader users hear it.
    if (status === "done" || status === "error") resultRef.current?.focus();
  }, [status]);

  const isCreate = proposal.kind === "create_ticket";
  const busy = status === "busy";
  const finished = status === "done";
  const confirmLabel = isCreate ? P.confirmSend : P.confirm;
  const blockedId = `${headingId}-blocked`;

  return (
    <section aria-labelledby={headingId} className="card stack">
      <p className="t-label row">
        <Icon name="sparkles" size="sm" />
        {P.intro}
      </p>
      <h3 id={headingId}>{title(proposal, ticketRef)}</h3>

      {proposal.kind === "create_ticket" && draft ? (
        <dl className="rail-rows">
          {[
            [COPY.chat.service, draft.serviceLabel],
            [COPY.request.summary, draft.summary],
            [COPY.detail.description, draft.description],
            [COPY.detail.impact, draft.impact],
            [COPY.detail.urgency, draft.urgency],
          ].map(([label, value]) => (
            <div key={label} className="rail-row">
              <dt>{label}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {proposal.kind === "add_participants" ? (
        <>
          <ul aria-label="Personas" className="plain-list">
            {proposal.names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {!ticketRef && !finished ? <p className="t-meta">{P.participants.queued}</p> : null}
        </>
      ) : null}

      {proposal.kind === "update_ticket" ? (
        <ul aria-label="Cambios propuestos" className="plain-list">
          {UPDATE_FIELDS.filter((field) => proposal[field] != null).map((field) => {
            const next = changeValue(field, proposal[field] as string);
            const prev = before[field];
            return (
              <li key={field}>{`${COPY.events.fields[field]}: ${prev ? `${prev} → ${next}` : next}`}</li>
            );
          })}
        </ul>
      ) : null}

      {proposal.kind === "close_ticket" ? <p>{P.close.body}</p> : null}

      {isCreate && blocked && !finished ? (
        <p id={blockedId} className="t-meta">
          {P.create.blocked}
        </p>
      ) : null}

      {finished || status === "error" ? (
        <div
          ref={resultRef}
          tabIndex={-1}
          role={finished ? "status" : "alert"}
          className={finished ? "alert tone-success" : "alert tone-error"}
        >
          <Icon name={finished ? "circle-check" : "circle-alert"} />
          <p>{message}</p>
        </div>
      ) : null}

      {notes.length > 0 ? (
        <ul aria-label="Para revisar" className="plain-list stack">
          {notes.map((note) => (
            <li key={note} className="alert tone-warning">
              <Icon name="triangle-alert" />
              <p>{note}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {finished && ticketRef ? (
        <p>
          <Link href={`/tickets/${ticketRef}`}>{P.seeTicket}</Link>
        </p>
      ) : null}

      {finished ? null : (
        <div className="actions">
          <Button
            busy={busy}
            busyLabel={P.working}
            disabled={busy || (isCreate && blocked)}
            aria-describedby={isCreate && blocked ? blockedId : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onDismiss}>
            {P.dismiss}
          </Button>
        </div>
      )}
    </section>
  );
}
