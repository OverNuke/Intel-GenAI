import type { components } from "@/lib/api-types";
import { formatDate } from "@/lib/ticket-labels";

type Event = components["schemas"]["TicketEventOut"];

export const KIND_LABELS: Record<string, string> = {
  created: "Ticket creado",
  assigned: "Asignado a un especialista",
  contact_requested: "TI te pidió un dato",
  note: "Nota de TI",
};

/** Requester-visible timeline, oldest first (the API already orders it). */
export function Timeline({ events }: { events: Event[] }) {
  return (
    <ol aria-label="Línea de tiempo" className="timeline">
      {events.map((event) => (
        <li key={event.id} className="timeline-item">
          <span className="ticket-row-summary">{KIND_LABELS[event.kind] ?? "Actualización"}</span>
          {event.body ? <span>{event.body}</span> : null}
          <span className="t-meta">{formatDate(event.created_at)}</span>
        </li>
      ))}
    </ol>
  );
}
