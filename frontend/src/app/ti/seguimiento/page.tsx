import { requireAccess } from "@/lib/guard";
import { serverGet } from "@/lib/server-api";
import { readServerContext } from "@/lib/server-context";
import { AppShell } from "@/ui/organisms/app-shell";
import { LogoutButton } from "@/ui/organisms/logout-button";
import { QueueContainer } from "@/ui/organisms/queue-container";

export const dynamic = "force-dynamic";

/** T1 Seguimiento de tickets. Other roles never get here: the guard sends them to A3. */
export default async function TiSeguimientoPage() {
  const { user } = await requireAccess("ticket-tracking");
  const result = await serverGet("/api/it/tickets", undefined, await readServerContext());
  if (!result.ok) throw new Error(`Could not load the ticket queue (status ${result.status}).`);
  return (
    <AppShell user={user} active="ticket-tracking" logout={<LogoutButton />}>
      <QueueContainer queue={result.data} />
    </AppShell>
  );
}
