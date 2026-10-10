import type { components } from "./api-types";
import { matchesIdOrSummary } from "./text-match";

type Row = components["schemas"]["QueueRowOut"];
export type Priority = Row["priority"];
export type SlaState = NonNullable<Row["sla_state"]>;

export type QueueTab = "all" | "unassigned" | "mine";
export type QueueFilter = { search: string; tab: QueueTab; priorities: Priority[]; slaStates: SlaState[] };
export type SortKey = "priority" | "sla" | null;
export type SortDir = "asc" | "desc";
export type QueueSort = { key: SortKey; dir: SortDir };

export const DEFAULT_QUEUE_FILTER: QueueFilter = { search: "", tab: "all", priorities: [], slaStates: [] };

const PRIORITY_RANK: Record<Priority, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export function isDefaultQueueFilter(filter: QueueFilter): boolean {
  return (
    filter.search === "" && filter.tab === "all" && filter.priorities.length === 0 && filter.slaStates.length === 0
  );
}

/** Pure, client-side filtering of the whole IT queue (the API returns it in one piece). */
export function filterQueue(rows: Row[], filter: QueueFilter): Row[] {
  return rows.filter((row) => {
    if (filter.tab === "unassigned" && row.assignee_name !== null) return false;
    if (filter.tab === "mine" && !row.assigned_to_me) return false;
    if (filter.priorities.length > 0 && !filter.priorities.includes(row.priority)) return false;
    if (filter.slaStates.length > 0 && (row.sla_state === null || !filter.slaStates.includes(row.sla_state))) {
      return false;
    }
    return matchesIdOrSummary(row.id, row.summary, filter.search);
  });
}

/**
 * Priority: "desc" puts critical first. SLA: "asc" is the soonest due date first. Tickets without
 * a due date are always last, whatever the direction. Stable; never mutates `rows`.
 */
export function sortQueue(rows: Row[], sort: QueueSort): Row[] {
  const copy = [...rows];
  if (sort.key === null) return copy;
  const sign = sort.dir === "asc" ? 1 : -1;
  if (sort.key === "priority") {
    return copy.sort((a, b) => sign * (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]));
  }
  return copy.sort((a, b) => {
    if (a.sla_due_at === null && b.sla_due_at === null) return 0;
    if (a.sla_due_at === null) return 1;
    if (b.sla_due_at === null) return -1;
    return sign * (Date.parse(a.sla_due_at) - Date.parse(b.sla_due_at));
  });
}
