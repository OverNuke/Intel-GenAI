import Link from "next/link";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import type { QueueSort, SortKey } from "@/lib/queue";
import { formatDate } from "@/lib/ticket-labels";

type Row = components["schemas"]["QueueRowOut"];

const PRIORITY_GLYPH: Record<Row["priority"], string> = { critical: "▲▲", high: "▲", medium: "■", low: "▽" };

function ariaSort(sort: QueueSort, key: Exclude<SortKey, null>): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.dir === "asc" ? "ascending" : "descending";
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: Exclude<SortKey, null>;
  sort: QueueSort;
  onSort: (key: Exclude<SortKey, null>) => void;
}) {
  return (
    <th scope="col" aria-sort={ariaSort(sort, sortKey)}>
      <button type="button" className="sort-button" onClick={() => onSort(sortKey)}>
        {label}
      </button>
    </th>
  );
}

/** T1 table. Sorting is a real button inside the header (keyboard operable, aria-sort). */
export function QueueTable({
  rows,
  sort,
  onSort,
}: {
  rows: Row[];
  sort: QueueSort;
  onSort: (key: Exclude<SortKey, null>) => void;
}) {
  return (
    <div className="table-scroll" role="region" aria-label={COPY.it.tableRegion} tabIndex={0}>
      <table className="queue-table">
        <thead>
          <tr>
            <th scope="col">{COPY.it.columns.id}</th>
            <th scope="col">{COPY.it.columns.summary}</th>
            <th scope="col">{COPY.it.columns.requester}</th>
            <SortableHeader label={COPY.it.columns.priority} sortKey="priority" sort={sort} onSort={onSort} />
            <th scope="col">{COPY.it.columns.state}</th>
            <th scope="col">{COPY.it.columns.assignee}</th>
            <SortableHeader label={COPY.it.columns.sla} sortKey="sla" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="t-id" href={`/ti/tickets/${row.id}`}>
                  {row.id}
                </Link>
              </td>
              <td>
                <span>{row.summary}</span>
                {row.via_ariadna ? (
                  <span className="t-meta">
                    {" "}
                    <span aria-hidden="true">✦ </span>
                    {COPY.it.viaAriadna}
                  </span>
                ) : null}
              </td>
              <td>{row.requester_name}</td>
              <td>
                <span aria-hidden="true">{PRIORITY_GLYPH[row.priority]} </span>
                {COPY.it.priorities[row.priority]}
              </td>
              <td>
                {COPY.it.statuses[row.status]}
                {row.awaiting_user ? (
                  <span className="t-meta">
                    <span aria-hidden="true"> · </span>
                    {COPY.it.pending}
                  </span>
                ) : null}
              </td>
              <td>{row.assignee_name ?? COPY.it.unassigned}</td>
              <td>
                {row.sla_state ? COPY.it.slaStates[row.sla_state] : COPY.it.noSla}
                {row.sla_due_at ? (
                  <span className="t-meta">
                    <span aria-hidden="true"> · </span>
                    {formatDate(row.sla_due_at)}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
