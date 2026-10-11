import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/guard";
import { serverGet } from "@/lib/server-api";
import { readServerContext } from "@/lib/server-context";
import { AppShell } from "@/ui/organisms/app-shell";
import { ConversationContainer } from "@/ui/organisms/conversation-container";
import { LogoutButton } from "@/ui/organisms/logout-button";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * U6 Conversación. Entry points: open (no params), `?servicio=<key>` or `?ticket=<INC id>`.
 * An unknown service or a ticket that is not yours sends the person back to U4.
 */
export default async function ConversacionPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const { user } = await requireAccess("new-request");
  const ctx = await readServerContext();

  const catalog = await serverGet("/api/catalog/services", undefined, ctx);
  if (!catalog.ok) throw new Error(`Could not load the catalog (status ${catalog.status}).`);

  const service = first(query.servicio);
  const ticket = first(query.ticket);

  let entry: { kind: "new" | "service" | "ticket"; ref: string | null } = { kind: "new", ref: null };
  let ticketSummary: string | null = null;

  if (service) {
    if (!catalog.data.some((s) => s.key === service)) redirect("/solicitud");
    entry = { kind: "service", ref: service };
  } else if (ticket) {
    const detail = await serverGet("/api/tickets/{display_id}", { display_id: ticket }, ctx);
    if (!detail.ok) {
      if (detail.status === 404) redirect("/solicitud");
      throw new Error(`Could not load the ticket (status ${detail.status}).`);
    }
    entry = { kind: "ticket", ref: detail.data.id };
    ticketSummary = detail.data.summary;
  }

  return (
    <AppShell user={user} active="new-request" variant="chat" logout={<LogoutButton />}>
      <ConversationContainer user={user} entry={entry} services={catalog.data} ticketSummary={ticketSummary} />
    </AppShell>
  );
}
