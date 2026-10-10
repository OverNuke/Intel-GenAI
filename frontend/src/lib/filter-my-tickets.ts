import type { components } from "./api-types";
import { matchesIdOrSummary } from "./text-match";

type Ticket = components["schemas"]["TicketOut"];
type Status = Ticket["status"];

export type Tab = "open" | "closed" | "all";
export type MyTicketsFilter = { search: string; states: Status[]; tab: Tab };

export const DEFAULT_FILTER: MyTicketsFilter = { search: "", states: [], tab: "open" };

const OPEN: ReadonlySet<Status> = new Set(["new", "assigned", "in_progress"]);

function inTab(status: Status, tab: Tab): boolean {
  if (tab === "all") return true;
  return tab === "open" ? OPEN.has(status) : !OPEN.has(status);
}

/** Pure, client-side filtering of the user's own tickets (the API returns the full list). */
export function filterMyTickets(tickets: Ticket[], filter: MyTicketsFilter): Ticket[] {
  return tickets.filter(
    (t) =>
      inTab(t.status, filter.tab) &&
      (filter.states.length === 0 || filter.states.includes(t.status)) &&
      matchesIdOrSummary(t.id, t.summary, filter.search),
  );
}

export function tabCounts(tickets: Ticket[]): Record<Tab, number> {
  const open = tickets.filter((t) => OPEN.has(t.status)).length;
  return { open, closed: tickets.length - open, all: tickets.length };
}

export function isDefaultFilter(filter: MyTicketsFilter): boolean {
  return filter.search === "" && filter.states.length === 0 && filter.tab === DEFAULT_FILTER.tab;
}
