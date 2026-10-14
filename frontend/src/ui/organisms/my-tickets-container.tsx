"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import {
  DEFAULT_FILTER,
  filterMyTickets,
  isDefaultFilter,
  tabCounts,
  type MyTicketsFilter,
  type Tab,
} from "@/lib/filter-my-tickets";
import { STAGE_ORDER, type TicketStatus } from "@/lib/ticket-labels";
import { Button } from "../atoms/button";
import { EmptyState } from "../molecules/empty-state";
import { PageHeader } from "../molecules/page-header";
import { TicketList } from "./ticket-list";

type Ticket = components["schemas"]["TicketOut"];

const TABS: readonly Tab[] = ["open", "closed", "all"];

/** U2 container: owns the filter state; filtering itself is a pure function. */
export function MyTicketsContainer({ tickets }: { tickets: Ticket[] }) {
  const [filter, setFilter] = useState<MyTicketsFilter>(DEFAULT_FILTER);
  const counts = tabCounts(tickets);
  const visible = filterMyTickets(tickets, filter);

  const toggleState = (status: TicketStatus) =>
    setFilter((current) => ({
      ...current,
      states: current.states.includes(status)
        ? current.states.filter((s) => s !== status)
        : [...current.states, status],
    }));

  const onTabKey = (event: KeyboardEvent, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length];
    if (next) setFilter((current) => ({ ...current, tab: next }));
  };

  const reset = () => setFilter(DEFAULT_FILTER);
  const clearButton = <Button variant="ghost" onClick={reset}>{COPY.clearFilters}</Button>;

  return (
    <div className="stack">
      <PageHeader
        title={COPY.list.heading}
        meta={COPY.list.intro}
        actions={
          <Link className="btn btn-primary" href="/solicitud/conversacion">
            {COPY.newTicket}
          </Link>
        }
      />

      <div className="card stack">
        <div className="field">
          <label htmlFor="tv-search">{COPY.list.searchLabel}</label>
          <input
            id="tv-search"
            type="search"
            className="input"
            autoComplete="off"
            placeholder={COPY.list.searchPlaceholder}
            value={filter.search}
            onChange={(event) => setFilter((current) => ({ ...current, search: event.target.value }))}
          />
        </div>
        <div role="group" aria-label={COPY.list.stateLabel} className="chip-row">
          <span className="t-meta">{COPY.list.stateLabel}</span>
          {STAGE_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              className="chip"
              aria-pressed={filter.states.includes(status)}
              onClick={() => toggleState(status)}
            >
              {COPY.stages[status]}
            </button>
          ))}
          {isDefaultFilter(filter) || visible.length === 0 ? null : clearButton}
        </div>
      </div>

      <div className="tabs-row">
        <div role="tablist" aria-label="Qué tickets mostrar" className="tabs">
          {TABS.map((tab, index) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`tv-tab-${tab}`}
              aria-selected={filter.tab === tab}
              aria-controls="tv-panel"
              tabIndex={filter.tab === tab ? 0 : -1}
              className="tab"
              onClick={() => setFilter((current) => ({ ...current, tab }))}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              {`${COPY.tabs[tab]} (${counts[tab]})`}
            </button>
          ))}
        </div>
        <p role="status" className="t-meta">
          {visible.length === 1 ? "1 ticket" : `${visible.length} tickets`}
        </p>
      </div>

      <div role="tabpanel" id="tv-panel" aria-labelledby={`tv-tab-${filter.tab}`}>
        {visible.length > 0 ? (
          <TicketList tickets={visible} />
        ) : (
          <EmptyState message={COPY.list.empty} action={clearButton} />
        )}
      </div>
    </div>
  );
}
