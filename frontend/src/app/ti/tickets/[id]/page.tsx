import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/guard";
import { serverGet } from "@/lib/server-api";
import { readServerContext } from "@/lib/server-context";
import { AppShell } from "@/ui/organisms/app-shell";
import { ContactUserContainer } from "@/ui/organisms/contact-user-container";
import { LogoutButton } from "@/ui/organisms/logout-button";

export const dynamic = "force-dynamic";

/** T2 Ficha del ticket (IT). Other roles are sent to A3 by the guard. */
export default async function TiTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireAccess("ticket-tracking");
  const result = await serverGet("/api/it/tickets/{display_id}", { display_id: id }, await readServerContext());
  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(`Could not load the ticket (status ${result.status}).`);
  }
  return (
    <AppShell user={user} active="ticket-tracking" logout={<LogoutButton />}>
      <ContactUserContainer initial={result.data} />
    </AppShell>
  );
}
