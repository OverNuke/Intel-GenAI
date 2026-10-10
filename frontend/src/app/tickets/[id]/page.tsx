import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/guard";
import { serverGet } from "@/lib/server-api";
import { readServerContext } from "@/lib/server-context";
import { AppShell } from "@/ui/organisms/app-shell";
import { LogoutButton } from "@/ui/organisms/logout-button";
import { TicketDetail } from "@/ui/organisms/ticket-detail";

export const dynamic = "force-dynamic";

/** U3 Detalle de ticket. A foreign or unknown id answers 404 and becomes the not-found screen. */
export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireAccess("my-tickets");
  const result = await serverGet("/api/tickets/{display_id}", { display_id: id }, await readServerContext());
  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(`Could not load the ticket (status ${result.status}).`);
  }
  return (
    <AppShell user={user} active="my-tickets" logout={<LogoutButton />}>
      <TicketDetail ticket={result.data} requesterName={user.name} />
    </AppShell>
  );
}
