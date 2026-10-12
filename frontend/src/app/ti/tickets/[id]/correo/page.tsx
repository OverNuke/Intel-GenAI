import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/guard";
import { COPY } from "@/lib/copy";
import { buildNotificationEmail } from "@/lib/notification-email";
import { serverGet } from "@/lib/server-api";
import { readServerContext } from "@/lib/server-context";
import { Icon } from "@/ui/atoms/icon";
import { AppShell } from "@/ui/organisms/app-shell";
import { LogoutButton } from "@/ui/organisms/logout-button";
import { NotificationEmail } from "@/ui/organisms/notification-email";

export const dynamic = "force-dynamic";

/** T4 Correo de aviso (IT, read-only). Reuses the ticket-tracking section; other roles reach A3 via the guard. */
export default async function TiTicketEmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireAccess("ticket-tracking");
  const result = await serverGet("/api/it/tickets/{display_id}", { display_id: id }, await readServerContext());
  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(`Could not load the ticket (status ${result.status}).`);
  }
  const email = buildNotificationEmail(result.data);
  return (
    <AppShell user={user} active="ticket-tracking" logout={<LogoutButton />}>
      <div className="stack">
        <div className="crumb">
          <Link className="btn btn-ghost" href={`/ti/tickets/${result.data.id}`}>
            <Icon name="arrow-left" size="sm" />
            {result.data.id}
          </Link>
          <span className="t-meta" aria-hidden="true">
            /
          </span>
          <span>{COPY.notificationEmail.title}</span>
        </div>
        <div className="page-head">
          <div>
            <h1 tabIndex={-1}>{COPY.notificationEmail.title}</h1>
            <p className="t-meta">{COPY.notificationEmail.line}</p>
          </div>
        </div>
        <NotificationEmail email={email} />
      </div>
    </AppShell>
  );
}
