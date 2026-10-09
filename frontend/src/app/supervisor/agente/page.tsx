import { requireAccess } from "@/lib/guard";
import { SectionPlaceholder } from "@/ui/organisms/section-placeholder";

export const dynamic = "force-dynamic";

export default async function SupervisorAgentePage() {
  const { user } = await requireAccess("agent-tracking");
  return <SectionPlaceholder user={user} active="agent-tracking" />;
}
