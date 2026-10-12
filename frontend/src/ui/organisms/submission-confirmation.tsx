import Link from "next/link";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { Icon } from "../atoms/icon";
import { AriadnaReceipt } from "./ariadna-receipt";

type Detail = components["schemas"]["TicketDetailOut"];

/** U7: the ticket exists. Everything shown comes from the stored ticket (refresh-safe). */
export function SubmissionConfirmation({ ticket }: { ticket: Detail }) {
  return (
    <div className="stack">
      <h1 tabIndex={-1}>{COPY.request.sentTitle}</h1>
      <p className="t-meta">{COPY.request.number}</p>
      <p className="t-id">{ticket.id}</p>
      <p>{COPY.request.sentBody}</p>
      {/* adapted: notification line (REQ-U7-M1); this page only renders for an existing ticket */}
      <p className="t-meta row">
        <Icon name="mail" size="sm" />
        {COPY.request.sentNotice}
      </p>
      {ticket.receipt ? (
        <AriadnaReceipt receipt={ticket.receipt} />
      ) : (
        <p role="note" className="callout">
          {COPY.request.sentHandoff}
        </p>
      )}
      <div className="actions">
        <Link className="btn btn-primary" href="/tickets">
          {COPY.request.seeMyTickets}
        </Link>
        <Link className="btn btn-secondary" href={`/tickets/${ticket.id}`}>
          {COPY.request.seeTicket}
        </Link>
      </div>
    </div>
  );
}
