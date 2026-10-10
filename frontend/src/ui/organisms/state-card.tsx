import type { ReactNode } from "react";

/** Centered card for single-message states (A3 "Sin acceso", A4 "Sesión cerrada"). */
export function StateCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="state-page">
      <main className="state-card" aria-labelledby="view-title">
        <p className="wordmark">Ariadna</p>
        {icon ? (
          <span className="state-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <h1 id="view-title">{title}</h1>
        {children}
      </main>
    </div>
  );
}
