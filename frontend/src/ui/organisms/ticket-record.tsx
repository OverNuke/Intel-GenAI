"use client";

import Link from "next/link";
import { useState } from "react";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { formatDate } from "@/lib/ticket-labels";
import { AriadnaReceipt } from "./ariadna-receipt";
import { StageTracker } from "./stage-tracker";
import { KIND_LABELS, Timeline } from "./timeline";

type Record = components["schemas"]["ItTicketOut"];
type TabKey = "summary" | "timeline" | "log";

const TABS: TabKey[] = ["summary", "timeline", "log"];
const FINISHED = new Set(["resolved", "closed"]);

/**
 * T2 presentational: the record of one ticket. Only "Contactar al usuario" works in this
 * change; the other RF-13 actions are shown disabled (phase 7).
 */
export function TicketRecord({ ticket, onContact }: { ticket: Record; onContact: () => void }) {
  const [tab, setTab] = useState<TabKey>("summary");
  const finished = FINISHED.has(ticket.status);
  const rows: [string, string][] = [
    [COPY.detail.impact, COPY.impact[ticket.impact]],
    [COPY.detail.urgency, COPY.urgency[ticket.urgency]],
    [COPY.detail.group, ticket.assigned_group],
    [COPY.it.columns.assignee, ticket.assignee_name ?? COPY.it.unassigned],
    [COPY.detail.asset, ticket.asset ?? COPY.detail.noAsset],
    [COPY.detail.created, formatDate(ticket.created_at)],
  ];
  const visibleEvents = ticket.events.filter((e) => e.visible_to_requester);

  return (
    <div className="stack">
      <Link href="/ti/seguimiento">{COPY.it.backToQueue}</Link>
      <div className="page-head">
        <div>
          <p className="t-id">{ticket.id}</p>
          <h1 tabIndex={-1}>{ticket.summary}</h1>
          <p className="t-meta">{`${COPY.it.requester}: ${ticket.requester_name}`}</p>
        </div>
      </div>

      <ul aria-label="Estado del ticket" className="plain-list">
        <li>
          <span className="t-meta">{COPY.detail.state} </span>
          <span>{COPY.it.statuses[ticket.status]}</span>
          {ticket.awaiting_user ? <span className="flag-pending">{COPY.it.pending}</span> : null}
        </li>
        <li>
          <span className="t-meta">{COPY.it.priority} </span>
          <span>{COPY.it.priorities[ticket.priority]}</span>
        </li>
        <li>
          <span className="t-meta">{COPY.it.sla} </span>
          <span>{ticket.sla_state ? COPY.it.slaStates[ticket.sla_state] : COPY.it.noSla}</span>
          {ticket.sla_due_at ? <span className="t-meta"> {formatDate(ticket.sla_due_at)}</span> : null}
        </li>
      </ul>

      <StageTracker
        status={ticket.status}
        awaitingUser={ticket.awaiting_user}
        labels={COPY.it.statuses}
        pendingLabel={null}
      />

      <div className="stack">
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            aria-disabled={finished ? "true" : undefined}
            onClick={finished ? undefined : onContact}
          >
            {COPY.it.contact}
          </button>
          {COPY.it.disabledActions.map((label) => (
            <button key={label} type="button" className="btn btn-secondary" aria-disabled="true">
              {label}
            </button>
          ))}
        </div>
        <p className="t-meta">{COPY.nextStage}</p>
      </div>

      <div role="tablist" aria-label="Secciones del ticket" className="tabs">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`rec-tab-${key}`}
            aria-selected={tab === key}
            aria-controls="rec-panel"
            tabIndex={tab === key ? 0 : -1}
            className="tab"
            onClick={() => setTab(key)}
          >
            {COPY.it.tabs2[key]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="rec-panel" aria-labelledby={`rec-tab-${tab}`} className="stack">
        {tab === "summary" ? (
          <>
            <section aria-labelledby="rec-desc" className="stack">
              <h2 id="rec-desc">{COPY.detail.description}</h2>
              <p>{ticket.description}</p>
            </section>
            <ul aria-label="Datos del ticket" className="plain-list data-rows">
              {rows.map(([label, value]) => (
                <li key={label}>
                  <span className="t-meta">{label}</span> <span>{value}</span>
                </li>
              ))}
            </ul>
            {ticket.receipt ? (
              <AriadnaReceipt receipt={ticket.receipt} />
            ) : (
              <p className="t-meta">{COPY.it.noReceipt}</p>
            )}
          </>
        ) : null}
        {tab === "timeline" ? <Timeline events={visibleEvents} /> : null}
        {tab === "log" ? (
          <ol aria-label={COPY.it.tabs2.log} className="timeline">
            {ticket.events.map((event) => (
              <li key={event.id} className="timeline-item">
                <span className="ticket-row-summary">
                  {event.author_name ?? "Sistema"} · {KIND_LABELS[event.kind] ?? event.kind}
                </span>
                {event.body ? <span>{event.body}</span> : null}
                <span className="t-meta">{formatDate(event.created_at)}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
