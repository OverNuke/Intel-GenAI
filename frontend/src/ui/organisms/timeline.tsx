import type { components } from "@/lib/api-types";
import { describeEvent } from "@/lib/ticket-events";
import { formatDate } from "@/lib/ticket-labels";

type Event = components["schemas"]["TicketEventOut"];

/** Requester-visible timeline, oldest first (the API already orders it). */
export function Timeline({ events, label = "Línea de tiempo" }: { events: Event[]; label?: string }) {
  return (
    <ol aria-label={label} className="timeline">
      {events.map((event) => {
        const view = describeEvent(event);
        return (
          <li key={event.id} className="timeline-item">
            <span className="ticket-row-summary">{view.title}</span>
            {view.lines.map((line, index) => (
              <span key={index}>{line}</span>
            ))}
            <span className="t-meta">{formatDate(event.created_at)}</span>
          </li>
        );
      })}
    </ol>
  );
}
