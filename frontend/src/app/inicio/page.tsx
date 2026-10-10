import { requireAccess } from "@/lib/guard";
import { serverGet } from "@/lib/server-api";
import { readServerContext } from "@/lib/server-context";
import { AppShell } from "@/ui/organisms/app-shell";
import { HomeView } from "@/ui/organisms/home-view";
import { LogoutButton } from "@/ui/organisms/logout-button";

export const dynamic = "force-dynamic";

/** U1 Inicio. */
export default async function InicioPage() {
  const { user } = await requireAccess("home");
  const ctx = await readServerContext();
  const [mine, catalog] = await Promise.all([
    serverGet("/api/tickets/mine", undefined, ctx),
    serverGet("/api/catalog/services", undefined, ctx),
  ]);
  if (!mine.ok) throw new Error(`Could not load your tickets (status ${mine.status}).`);
  if (!catalog.ok) throw new Error(`Could not load the catalog (status ${catalog.status}).`);
  return (
    <AppShell user={user} active="home" logout={<LogoutButton />}>
      <HomeView user={user} summary={mine.data.summary} tickets={mine.data.tickets} services={catalog.data} />
    </AppShell>
  );
}
