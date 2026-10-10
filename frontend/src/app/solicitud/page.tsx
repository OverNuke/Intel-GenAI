import { requireAccess } from "@/lib/guard";
import { serverGet } from "@/lib/server-api";
import { readServerContext } from "@/lib/server-context";
import { AppShell } from "@/ui/organisms/app-shell";
import { LogoutButton } from "@/ui/organisms/logout-button";
import { ServiceCatalog } from "@/ui/organisms/service-catalog";

export const dynamic = "force-dynamic";

/** U4 ¿Qué necesitas?: the service catalog, open to every role. */
export default async function SolicitudPage() {
  const { user } = await requireAccess("new-request");
  const result = await serverGet("/api/catalog/services", undefined, await readServerContext());
  if (!result.ok) throw new Error(`Could not load the catalog (status ${result.status}).`);
  return (
    <AppShell user={user} active="new-request" logout={<LogoutButton />}>
      <ServiceCatalog services={result.data} />
    </AppShell>
  );
}
