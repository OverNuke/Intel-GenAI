import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";

type Ticket = components["schemas"]["ItTicketOut"];

export type NotificationEmail = {
  id: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  /** Suffix for the body line: " con ayuda de Ariadna" or "". */
  via: string;
  summary: string;
  description: string;
  requester: string;
  area: string;
  location: string;
  contact: string;
  impact: string;
  urgency: string;
  asset: string;
  attachments: string;
};

const orPlaceholder = (value: string | null | undefined): string => (value && value.trim() ? value : COPY.notificationEmail.noData);

/**
 * Pure builder for the T4 preview. Cc, área, ubicación, contacto and adjuntos are not part of the
 * ticket contract, so they use the fixed placeholder; nothing is invented and it never throws.
 */
export function buildNotificationEmail(ticket: Ticket): NotificationEmail {
  const copy = COPY.notificationEmail;
  const lines = (ticket.description ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);
  return {
    id: ticket.id,
    from: copy.from,
    to: orPlaceholder(ticket.assigned_group),
    cc: copy.noData,
    subject: `${copy.subjectPrefix} ${ticket.id}: ${ticket.summary ?? ""}`.trimEnd(),
    via: ticket.via_ariadna ? copy.viaAriadna : "",
    summary: orPlaceholder(ticket.summary),
    description: orPlaceholder(lines.join(" · ")),
    requester: orPlaceholder(ticket.requester_name),
    area: copy.noData,
    location: copy.noData,
    contact: copy.noData,
    impact: COPY.impact[ticket.impact] ?? copy.noData,
    urgency: COPY.urgency[ticket.urgency] ?? copy.noData,
    asset: ticket.asset ?? COPY.detail.noAsset,
    attachments: copy.noData,
  };
}
