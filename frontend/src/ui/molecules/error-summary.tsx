"use client";

import { useEffect, useRef } from "react";

export type SummaryItem = { fieldId: string; message: string };

/** Alert that takes focus when it mounts. Remount it (change `key`) to re-announce on each submit. */
export function ErrorSummary({ items = [], message }: { items?: SummaryItem[]; message?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div ref={ref} role="alert" tabIndex={-1} className="error-summary">
      {items.length > 0 ? (
        <>
          <p>Revisa lo siguiente:</p>
          <ul>
            {items.map((item) => (
              <li key={item.fieldId}>
                <a
                  href={`#${item.fieldId}`}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(item.fieldId)?.focus();
                  }}
                >
                  {item.message}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        message
      )}
    </div>
  );
}
