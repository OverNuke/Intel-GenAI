import Link from "next/link";
import type { components } from "@/lib/api-types";
import { formatDate, stateIndicator } from "@/lib/ticket-labels";

type Ticket = components["schemas"]["TicketOut"];

/** One ticket as a single link (Enter opens U3). State is text + glyph, never colour only. */
export function TicketRow({ ticket }: { ticket: Ticket }) {
  const state = stateIndicator(ticket.status, ticket.awaiting_user);
  return (
    <li className="ticket-row">
      <Link className="ticket-row-link" href={`/tickets/${ticket.id}`}>
        <span className="t-id">{ticket.id}</span>
        <span className="ticket-row-summary">{ticket.summary}</span>
        <span className="ticket-state">
          <span aria-hidden="true">{state.glyph}</span> {state.label}
        </span>
        <span className="t-meta">Actualizado {formatDate(ticket.updated_at)}</span>
      </Link>
    </li>
  );
}
