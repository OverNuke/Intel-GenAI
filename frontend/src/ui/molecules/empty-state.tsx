import type { ReactNode } from "react";

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div role="status" className="empty-state">
      <p>{message}</p>
      {action}
    </div>
  );
}
