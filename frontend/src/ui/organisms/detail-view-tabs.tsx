"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { COPY } from "@/lib/copy";

type ViewKey = "summary" | "timeline";
const VIEWS: ViewKey[] = ["summary", "timeline"];
const LABELS: Record<ViewKey, string> = { summary: COPY.detail.summaryTab, timeline: COPY.detail.timeline };

/**
 * U3 small-screen view switch. Both panels stay in the DOM (and the accessibility tree); the
 * unselected one only gets `.is-inactive`, which hides it under the compact breakpoint.
 * On wide screens the tablist and the timeline panel are hidden (the stepper is the timeline).
 */
export function DetailViewTabs({ summary, timeline }: { summary: ReactNode; timeline: ReactNode }) {
  const [view, setView] = useState<ViewKey>("summary");
  const refs = useRef<Record<ViewKey, HTMLButtonElement | null>>({ summary: null, timeline: null });

  const move = (event: KeyboardEvent<HTMLButtonElement>, from: ViewKey) => {
    const index = VIEWS.indexOf(from);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % VIEWS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + VIEWS.length) % VIEWS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = VIEWS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const key = VIEWS[next]!;
    setView(key);
    refs.current[key]?.focus();
  };

  return (
    <div className="card stack">
      <div role="tablist" aria-label={COPY.detail.viewLabel} className="tabs compact-only">
        {VIEWS.map((key) => (
          <button
            key={key}
            ref={(node) => {
              refs.current[key] = node;
            }}
            type="button"
            role="tab"
            id={`detail-tab-${key}`}
            aria-selected={view === key}
            aria-controls={`detail-panel-${key}`}
            tabIndex={view === key ? 0 : -1}
            className="tab"
            onClick={() => setView(key)}
            onKeyDown={(event) => move(event, key)}
          >
            {LABELS[key]}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="detail-panel-summary"
        aria-labelledby="detail-tab-summary"
        className={`stack${view === "summary" ? "" : " is-inactive"}`}
      >
        {summary}
      </div>
      <div
        role="tabpanel"
        id="detail-panel-timeline"
        aria-labelledby="detail-tab-timeline"
        className={`stack compact-only${view === "timeline" ? "" : " is-inactive"}`}
      >
        {timeline}
      </div>
    </div>
  );
}
