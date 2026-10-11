import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { lifeStages } from "@/lib/life-stages";
import { formatDate } from "@/lib/ticket-labels";
import { Icon, type IconName } from "../atoms/icon";
import { StatusPill } from "../molecules/status-pill";
import { AriadnaReceipt } from "./ariadna-receipt";
import { DetailViewTabs } from "./detail-view-tabs";
import { LifeTimeline } from "./life-timeline";
import { NeedDataNotice } from "./need-data-notice";
import { RecordHeader } from "./record-header";
import { StageTracker } from "./stage-tracker";

type Detail = components["schemas"]["TicketDetailOut"];

/** U3 presentational: the whole ticket arrives from the API; nothing is derived server-side here. */
export function TicketDetail({ ticket, requesterName }: { ticket: Detail; requesterName: string }) {
  const rows: [IconName, string, string][] = [
    ["user", COPY.detail.requester, requesterName],
    ["users", COPY.detail.impact, COPY.impact[ticket.impact]],
    ["signal-medium", COPY.detail.urgency, COPY.urgency[ticket.urgency]],
    ["signpost", COPY.detail.group, ticket.assigned_group],
    ["user-check", COPY.detail.assignee, ticket.assignee_name ?? COPY.detail.unassigned],
    ["laptop", COPY.detail.asset, ticket.asset ?? COPY.detail.noAsset],
    ["paperclip", COPY.detail.attachments, COPY.detail.noAttachments],
    // adapted: "clock" is a Lucide icon outside the mock's extracted sprite (see icon-paths.tsx).
    ["clock", COPY.detail.created, formatDate(ticket.created_at)],
  ];

  return (
    <div className="stack">
      <RecordHeader
        crumb={{ href: "/tickets", label: COPY.myTickets }}
        id={ticket.id}
        title={ticket.summary}
        subtitle={ticket.service_label}
        help={{ href: `/solicitud/conversacion?ticket=${ticket.id}`, label: COPY.detail.help }}
        sample
      >
        <div>
          <span className="t-meta">{COPY.detail.state}</span>
          <div className="chip-row">
            <StatusPill status={ticket.status} awaitingUser={ticket.awaiting_user} />
          </div>
        </div>
        <div>
          <span className="t-meta">{COPY.detail.lastUpdate}</span>
          <strong>{formatDate(ticket.updated_at)}</strong>
          <span className="t-meta">{`${COPY.detail.created}: ${formatDate(ticket.created_at)}`}</span>
        </div>
      </RecordHeader>

      {ticket.awaiting_user ? <NeedDataNotice message={ticket.contact_notice} /> : null}

      <div className="band wide-only">
        <StageTracker status={ticket.status} awaitingUser={ticket.awaiting_user} />
      </div>

      <div className="rec-body rec-body--detail">
        <div className="stack">
          <DetailViewTabs
            summary={
              <section aria-labelledby="detail-description" className="stack">
                <h2 id="detail-description">{COPY.detail.description}</h2>
                <p>{ticket.description}</p>
              </section>
            }
            timeline={
              <section aria-labelledby="detail-timeline" className="stack">
                <h2 id="detail-timeline">{COPY.detail.timeline}</h2>
                <LifeTimeline stages={lifeStages(ticket)} />
              </section>
            }
          />
          {ticket.receipt ? <AriadnaReceipt receipt={ticket.receipt} /> : null}
        </div>
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
    </div>
  );
}
