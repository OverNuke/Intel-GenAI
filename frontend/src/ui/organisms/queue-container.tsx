"use client";

import { useState, type KeyboardEvent } from "react";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import {
  DEFAULT_QUEUE_FILTER,
  filterQueue,
  isDefaultQueueFilter,
  sortQueue,
  type Priority,
  type QueueFilter,
  type QueueSort,
  type QueueTab,
  type SlaState,
  type SortKey,
} from "@/lib/queue";
import { Button } from "../atoms/button";
import { EmptyState } from "../molecules/empty-state";
import { QueueSummaryCards } from "./queue-summary";
import { QueueTable } from "./queue-table";

type Queue = components["schemas"]["QueueOut"];

const TABS: QueueTab[] = ["all", "unassigned", "mine"];
const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const SLA_STATES: SlaState[] = ["overdue", "due_soon", "on_time"];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** T1 container: owns filters and sort; the lists are pure functions over the full queue. */
export function QueueContainer({ queue }: { queue: Queue }) {
  const [filter, setFilter] = useState<QueueFilter>(DEFAULT_QUEUE_FILTER);
  const [sort, setSort] = useState<QueueSort>({ key: null, dir: "asc" });
  const rows = sortQueue(filterQueue(queue.tickets, filter), sort);

  function onSort(key: Exclude<SortKey, null>) {
    setSort((current) => {
      if (current.key !== key) return { key, dir: key === "priority" ? "desc" : "asc" };
      return { key, dir: current.dir === "asc" ? "desc" : "asc" };
    });
  }

  function onTabKey(event: KeyboardEvent, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length];
    if (next) setFilter((current) => ({ ...current, tab: next }));
  }

  const reset = () => {
    setFilter(DEFAULT_QUEUE_FILTER);
    setSort({ key: null, dir: "asc" });
  };
  const clearButton = <Button variant="ghost" onClick={reset}>{COPY.clearFilters}</Button>;

  return (
    <div className="stack">
      <div>
        <h1 tabIndex={-1}>{COPY.it.queueTitle}</h1>
        <p className="t-meta">{COPY.it.queueIntro}</p>
      </div>

      <QueueSummaryCards summary={queue.summary} />

      <div className="card stack">
        <div className="field">
          <label htmlFor="q-search">{COPY.it.search}</label>
          <input
            id="q-search"
            type="search"
            className="input"
            autoComplete="off"
            value={filter.search}
            onChange={(event) => setFilter((current) => ({ ...current, search: event.target.value }))}
          />
        </div>
        <div role="group" aria-label={COPY.it.priority} className="chip-row">
          <span className="t-meta">{COPY.it.priority}</span>
          {PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              className="chip"
              aria-pressed={filter.priorities.includes(priority)}
              onClick={() => setFilter((c) => ({ ...c, priorities: toggle(c.priorities, priority) }))}
            >
              {COPY.it.priorities[priority]}
            </button>
          ))}
        </div>
        <div role="group" aria-label={COPY.it.sla} className="chip-row">
          <span className="t-meta">{COPY.it.sla}</span>
          {SLA_STATES.map((state) => (
            <button
              key={state}
              type="button"
              className="chip"
              aria-pressed={filter.slaStates.includes(state)}
              onClick={() => setFilter((c) => ({ ...c, slaStates: toggle(c.slaStates, state) }))}
            >
              {COPY.it.slaStates[state]}
            </button>
          ))}
          {isDefaultQueueFilter(filter) || rows.length === 0 ? null : clearButton}
        </div>
      </div>

      <div className="tabs-row">
        <div role="tablist" aria-label="Qué tickets mostrar" className="tabs">
          {TABS.map((tab, index) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`q-tab-${tab}`}
              aria-selected={filter.tab === tab}
              aria-controls="q-panel"
              tabIndex={filter.tab === tab ? 0 : -1}
              className="tab"
              onClick={() => setFilter((current) => ({ ...current, tab }))}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              {COPY.it.tabs[tab]}
            </button>
          ))}
        </div>
        <p role="status" className="t-meta">
          {rows.length === 1 ? "1 ticket" : `${rows.length} tickets`}
        </p>
      </div>

      <div role="tabpanel" id="q-panel" aria-labelledby={`q-tab-${filter.tab}`}>
        {rows.length > 0 ? (
          <QueueTable rows={rows} sort={sort} onSort={onSort} />
        ) : (
          <EmptyState message={COPY.it.empty} action={clearButton} />
        )}
      </div>
    </div>
  );
}
