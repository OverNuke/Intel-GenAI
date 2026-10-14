import type { ReactNode } from "react";

/** `busy` marks a placeholder shown while content loads (same box, announced as busy). */
export function EmptyState({
  message,
  action,
  busy,
}: {
  message: string;
  action?: ReactNode;
  busy?: boolean;
}) {
  return (
    <div role="status" className="empty-state" aria-busy={busy ? true : undefined}>
      <p>{message}</p>
      {action}
    </div>
  );
}
