import { requireAccess } from "@/lib/guard";
import { serverGet } from "@/lib/server-api";
import { readServerContext } from "@/lib/server-context";
import { AgentMetricsContainer } from "@/ui/organisms/agent-metrics-container";
import { AppShell } from "@/ui/organisms/app-shell";
import { LogoutButton } from "@/ui/organisms/logout-button";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** S1 Seguimiento del agente (Supervisor only; the guard sends everyone else to A3). */
export default async function SupervisorAgentePage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const { user } = await requireAccess("agent-tracking");
  const ctx = await readServerContext();
  const [week, month] = await Promise.all([
    serverGet("/api/metrics/agent", undefined, ctx, undefined, { period: "7" }),
    serverGet("/api/metrics/agent", undefined, ctx, undefined, { period: "30" }),
  ]);
  if (!week.ok) throw new Error(`Could not load the metrics (status ${week.status}).`);
  if (!month.ok) throw new Error(`Could not load the metrics (status ${month.status}).`);
  const initialPeriod = first(query.periodo) === "30" ? 30 : 7;
  return (
    <AppShell user={user} active="agent-tracking" logout={<LogoutButton />}>
      <AgentMetricsContainer reports={{ 7: week.data, 30: month.data }} initialPeriod={initialPeriod} />
    </AppShell>
  );
}
