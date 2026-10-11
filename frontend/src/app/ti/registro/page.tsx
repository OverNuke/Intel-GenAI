import { requireAccess } from "@/lib/guard";
import { AppShell } from "@/ui/organisms/app-shell";
import { ComingSoon } from "@/ui/organisms/coming-soon";
import { LogoutButton } from "@/ui/organisms/logout-button";

export const dynamic = "force-dynamic";

/** Registro (T3 sibling): no screen in this change. IT sees a placeholder, others get A3. */
export default async function RegistroPage() {
  const { user } = await requireAccess("registry");
  return (
    <AppShell user={user} active="registry" logout={<LogoutButton />}>
      <ComingSoon title="Registro" />
    </AppShell>
  );
}
