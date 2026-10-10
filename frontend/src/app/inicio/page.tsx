import { requireAccess } from "@/lib/guard";
import { SectionPlaceholder } from "@/ui/organisms/section-placeholder";

export const dynamic = "force-dynamic";

export default async function InicioPage() {
  const { user } = await requireAccess("home");
  return <SectionPlaceholder user={user} active="home" />;
}
