import { requireAccess } from "@/lib/guard";
import { SectionPlaceholder } from "@/ui/organisms/section-placeholder";

export const dynamic = "force-dynamic";

export default async function TiSeguimientoPage() {
  const { user } = await requireAccess("ticket-tracking");
  return <SectionPlaceholder user={user} active="ticket-tracking" />;
}
