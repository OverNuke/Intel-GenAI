import type { components } from "@/lib/api-types";
import { TicketRow } from "../molecules/ticket-row";

type Ticket = components["schemas"]["TicketOut"];

export function TicketList({ tickets, label = "Tickets" }: { tickets: Ticket[]; label?: string }) {
  return (
    <ul aria-label={label} className="ticket-list">
      {tickets.map((ticket) => (
        <TicketRow key={ticket.id} ticket={ticket} />
      ))}
    </ul>
  );
}
