import { requireAccess } from "@/lib/guard";
import { AppShell } from "@/ui/organisms/app-shell";
import { ComingSoon } from "@/ui/organisms/coming-soon";
import { LogoutButton } from "@/ui/organisms/logout-button";

export const dynamic = "force-dynamic";

/** Cierre (T3, phase 7): no screen in this change. IT sees a placeholder, others get A3. */
export default async function CierrePage() {
  const { user } = await requireAccess("closure");
  return (
    <AppShell user={user} active="closure" logout={<LogoutButton />}>
      <ComingSoon title="Cierre" />
    </AppShell>
  );
}
