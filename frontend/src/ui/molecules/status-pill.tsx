import { COPY } from "@/lib/copy";
import { type Pill, type TicketStatus, pendingPill, statusPill } from "@/lib/ticket-labels";
import { Icon } from "../atoms/icon";

function PillView({ pill }: { pill: Pill }) {
  return (
    <span className={`pill tone-${pill.tone}`}>
      <Icon name={pill.icon} size="sm" />
      {pill.label}
    </span>
  );
}

/**
 * The status of a ticket as text + icon (REQ-VF-3). When it awaits the user, an additional
 * warning pill follows: "pending" is a flag, never a replacement for the status.
 */
export function StatusPill({
  status,
  awaitingUser = false,
  labels = COPY.stages,
  pendingLabel = COPY.needData,
}: {
  status: TicketStatus;
  awaitingUser?: boolean;
  labels?: Record<TicketStatus, string>;
  pendingLabel?: string;
}) {
  return (
    <>
      <PillView pill={statusPill(status, labels)} />
      {awaitingUser ? <PillView pill={pendingPill(pendingLabel)} /> : null}
    </>
  );
}
