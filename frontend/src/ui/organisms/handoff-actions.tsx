"use client";

import { COPY } from "@/lib/copy";
import { Button } from "../atoms/button";

/**
 * "Hablar con TI" and "Pasar con TI" are never disabled: loading, error and degraded states
 * included (RF-10). They hand the captured draft to the person's confirmation, nothing more.
 */
export function HandoffActions({ onHandoff, active = false }: { onHandoff: () => void; active?: boolean }) {
  return (
    <div className="stack">
      <div className="actions">
        <Button variant="secondary" onClick={onHandoff}>
          {COPY.chat.talkToIt}
        </Button>
        <Button variant="secondary" onClick={onHandoff}>
          {COPY.chat.passToIt}
        </Button>
      </div>
      {active ? (
        <p role="status" className="callout">
          {COPY.chat.itDone}
        </p>
      ) : null}
    </div>
  );
}
