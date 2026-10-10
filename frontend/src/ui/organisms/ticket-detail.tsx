import Link from "next/link";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { formatDate, stateIndicator } from "@/lib/ticket-labels";
import { AriadnaReceipt } from "./ariadna-receipt";
import { NeedDataNotice } from "./need-data-notice";
import { StageTracker } from "./stage-tracker";
import { Timeline } from "./timeline";

type Detail = components["schemas"]["TicketDetailOut"];

/** U3 presentational: the whole ticket arrives from the API; nothing is derived server-side here. */
export function TicketDetail({ ticket, requesterName }: { ticket: Detail; requesterName: string }) {
  const state = stateIndicator(ticket.status, ticket.awaiting_user);
  const rows: [string, string][] = [
    [COPY.detail.requester, requesterName],
    [COPY.detail.impact, COPY.impact[ticket.impact]],
    [COPY.detail.urgency, COPY.urgency[ticket.urgency]],
    [COPY.detail.group, ticket.assigned_group],
    [COPY.detail.assignee, ticket.assignee_name ?? COPY.detail.unassigned],
    [COPY.detail.asset, ticket.asset ?? COPY.detail.noAsset],
  ];

  return (
    <div className="stack">
      <Link href="/tickets">{COPY.myTickets}</Link>
      <div className="page-head">
        <div>
          <p className="t-id">{ticket.id}</p>
          <h1 tabIndex={-1}>{ticket.summary}</h1>
          <p className="t-meta">{ticket.service_label}</p>
        </div>
        <Link
          className="btn btn-secondary"
          href={`/solicitud/conversacion?ticket=${ticket.id}`}
          aria-label={COPY.detail.help}
        >
          (?)
        </Link>
      </div>

      <p className="ticket-state">
        <span className="t-meta">{COPY.detail.state}: </span>
        <span aria-hidden="true">{state.glyph}</span> {state.label}
      </p>
      <p className="t-meta">Creado: {formatDate(ticket.created_at)}</p>
      <p className="t-meta">Última actualización: {formatDate(ticket.updated_at)}</p>

      {ticket.awaiting_user ? <NeedDataNotice message={ticket.contact_notice} /> : null}

      <StageTracker status={ticket.status} awaitingUser={ticket.awaiting_user} />

      <section aria-labelledby="detail-description" className="stack">
        <h2 id="detail-description">{COPY.detail.description}</h2>
        <p>{ticket.description}</p>
      </section>

      <ul aria-label="Datos del ticket" className="plain-list data-rows">
        {rows.map(([label, value]) => (
          <li key={label}>
            <span className="t-meta">{label}</span> <span>{value}</span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="detail-timeline" className="stack">
        <h2 id="detail-timeline">{COPY.detail.timeline}</h2>
        <Timeline events={ticket.events} />
      </section>

      {ticket.receipt ? <AriadnaReceipt receipt={ticket.receipt} /> : null}
    </div>
  );
}
