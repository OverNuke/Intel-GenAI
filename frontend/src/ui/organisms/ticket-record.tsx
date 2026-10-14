"use client";

import Link from "next/link";
import { useState } from "react";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { formatDate } from "@/lib/ticket-labels";
import { Icon, type IconName } from "../atoms/icon";
import { StatusPill } from "../molecules/status-pill";
import { AriadnaReceipt } from "./ariadna-receipt";
import { RecordHeader } from "./record-header";
import { StageTracker } from "./stage-tracker";
import { describeEvent } from "@/lib/ticket-events";
import { Timeline } from "./timeline";

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
  const rows: [IconName, string, string][] = [
    ["users", COPY.detail.impact, COPY.impact[ticket.impact]],
    ["signal-medium", COPY.detail.urgency, COPY.urgency[ticket.urgency]],
    ["signpost", COPY.detail.group, ticket.assigned_group],
    ["user-check", COPY.it.columns.assignee, ticket.assignee_name ?? COPY.it.unassigned],
    ["laptop", COPY.detail.asset, ticket.asset ?? COPY.detail.noAsset],
    ...(ticket.participants.length > 0
      ? ([["users", COPY.detail.participants, ticket.participants.join(", ")]] as [IconName, string, string][])
      : []),
    ["clock", COPY.detail.created, formatDate(ticket.created_at)],
  ];
  const visibleEvents = ticket.events.filter((e) => e.visible_to_requester);

  return (
    <div className="stack">
      <RecordHeader
        back={{ href: "/ti/seguimiento", label: COPY.it.backToQueue }}
        id={ticket.id}
        title={ticket.summary}
        subtitle={`${COPY.it.requester}: ${ticket.requester_name}`}
      >
        <div>
          <span className="t-meta">{COPY.detail.state}</span>
          <div className="chip-row">
            <StatusPill
              status={ticket.status}
              awaitingUser={ticket.awaiting_user}
              labels={COPY.it.statuses}
              pendingLabel={COPY.it.pending}
            />
          </div>
        </div>
        <div>
          <span className="t-meta">{COPY.it.priority}</span>
          <strong>{COPY.it.priorities[ticket.priority]}</strong>
          <span className="t-meta">{COPY.it.sla}</span>
          <span>{ticket.sla_state ? COPY.it.slaStates[ticket.sla_state] : COPY.it.noSla}</span>
          {ticket.sla_due_at ? <span className="t-meta">{formatDate(ticket.sla_due_at)}</span> : null}
        </div>
      </RecordHeader>

      <div className="band">
        <StageTracker
          status={ticket.status}
          awaitingUser={ticket.awaiting_user}
          labels={COPY.it.statuses}
          pendingLabel={null}
        />
      </div>

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
          <Link className="btn btn-ghost" href={`/ti/tickets/${ticket.id}/correo`}>
            <Icon name="mail" size="sm" />
            {COPY.notificationEmail.action}
          </Link>
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
            <div className="rec-body">
              <section aria-labelledby="rec-desc" className="stack">
                <h2 id="rec-desc">{COPY.detail.description}</h2>
                <p>{ticket.description}</p>
              </section>
              <aside className="card" aria-label={COPY.detail.railLabel}>
                <dl className="rail-rows">
                  {rows.map(([icon, label, value]) => (
                    <div key={label} className="rail-row">
                      <Icon name={icon} size="sm" />
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </aside>
            </div>
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
            {ticket.events.map((event) => {
              const view = describeEvent(event);
              return (
                <li key={event.id} className="timeline-item">
                  <span className="ticket-row-summary">
                    {event.author_name ?? "Sistema"} · {view.title}
                  </span>
                  {view.lines.map((line, index) => (
                    <span key={index}>{line}</span>
                  ))}
                  <span className="t-meta">{formatDate(event.created_at)}</span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
