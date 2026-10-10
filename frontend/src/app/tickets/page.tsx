import { serverGet } from "@/lib/server-api";
import { readServerContext } from "@/lib/server-context";
import { requireAccess } from "@/lib/guard";
import { AppShell } from "@/ui/organisms/app-shell";
import { LogoutButton } from "@/ui/organisms/logout-button";
import { MyTicketsContainer } from "@/ui/organisms/my-tickets-container";

export const dynamic = "force-dynamic";

/** U2 Mis tickets. */
export default async function TicketsPage() {
  const { user } = await requireAccess("my-tickets");
  const result = await serverGet("/api/tickets/mine", undefined, await readServerContext());
  if (!result.ok) throw new Error(`Could not load your tickets (status ${result.status}).`);
  return (
    <AppShell user={user} active="my-tickets" logout={<LogoutButton />}>
      <MyTicketsContainer tickets={result.data.tickets} />
    </AppShell>
  );
}
