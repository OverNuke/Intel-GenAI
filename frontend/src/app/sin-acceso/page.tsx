import Link from "next/link";
import { redirect } from "next/navigation";
import { deniedSentence, parseDenied, ROLE_HOME } from "@/lib/access-labels";
import { checkAccess } from "@/lib/guard";
import { readServerContext } from "@/lib/server-context";
import { Icon } from "@/ui/atoms/icon";
import { StateCard } from "@/ui/organisms/state-card";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// A3 copy is INFERRED from RF-03 + ADR-0004 (the mock has no screen for it): confirm with the user.
export default async function SinAccesoPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  // "home" is open to every role, so this only resolves who is looking (for "Ir a tu sección").
  const viewer = await checkAccess("home", await readServerContext());
  if (viewer.kind !== "allowed") redirect("/entrar");
  const denied = parseDenied({ section: first(query.section), required: first(query.required) });

  return (
    <StateCard title="Sin acceso" icon={<Icon name="lock" size="lg" />}>
      <p>{deniedSentence(denied.section, denied.required)}</p>
      <div className="actions">
        <Link className="btn btn-primary" href={ROLE_HOME[viewer.user.role]}>
          Ir a tu sección
        </Link>
        <Link className="btn btn-secondary" href="/entrar">
          Cambiar de cuenta
        </Link>
      </div>
    </StateCard>
  );
}
