"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/access-labels";
import type { components } from "@/lib/api-types";

type User = components["schemas"]["UserOut"];
type Role = User["role"];

const ORG = "Centro Administrativo Regional Sur";
const OWN_TICKETS = ["Mis tickets", "¿Qué necesitas?", "Mi equipo"] as const;

const LIVE_SECTION: Record<Role, { key: string; label: string }> = {
  user: { key: "home", label: "Inicio" },
  it: { key: "ticket-tracking", label: "Seguimiento de tickets" },
  supervisor: { key: "agent-tracking", label: "Seguimiento del agente" },
};

const ROLE_TITLE: Record<Role, string | null> = { user: null, it: "Consultor TI", supervisor: "Supervisora" };

function contextLine(user: User): string {
  if (user.role === "it") return `Mesa de ayuda TI · ${ORG}`;
  if (user.role === "supervisor") return `Supervisión de la mesa de ayuda · ${ORG}`;
  return `${user.area} · ${ORG}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Disabled({ label }: { label: string }) {
  return (
    <li>
      <span className="rail-item" aria-disabled="true">
        {label}
      </span>
    </li>
  );
}

function Rail({ user, active }: { user: User; active: string }) {
  const live = LIVE_SECTION[user.role];
  return (
    <nav aria-label="Secciones" className="rail">
      <ul>
        <li>
          <Link
            href={ROLE_HOME[user.role]}
            className="rail-item"
            aria-current={active === live.key ? "page" : undefined}
          >
            {live.label}
          </Link>
        </li>
        {user.role === "user" ? (
          OWN_TICKETS.map((label) => <Disabled key={label} label={label} />)
        ) : (
          <li>
            <ul role="group" aria-labelledby="rail-own" aria-describedby="rail-own-note">
              <li id="rail-own" className="t-meta">
                Tus propios tickets
              </li>
              {OWN_TICKETS.map((label) => (
                <Disabled key={label} label={label} />
              ))}
              <li id="rail-own-note" className="t-meta">
                Próxima etapa del prototipo
              </li>
            </ul>
          </li>
        )}
      </ul>
    </nav>
  );
}

export type AppShellProps = {
  user: User;
  /** Key of the section being shown (marks the rail item as current). */
  active: string;
  /** Slot for the sign-out menu item (a container). */
  logout: ReactNode;
  children: ReactNode;
};

export function AppShell({ user, active, logout, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const title = ROLE_TITLE[user.role];

  return (
    <div className="app">
      <Rail user={user} active={active} />
      <header className="topbar">
        <div>
          <p className="wordmark">Ariadna</p>
          <p className="t-meta">{contextLine(user)}</p>
        </div>
        <div className="profile">
          <button
            type="button"
            id="profile-btn"
            className="btn btn-ghost"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls="profile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true" className="avatar">
              {initials(user.name)}
            </span>
            {user.name}
            {user.role === "user" ? null : <span className="t-meta"> {ROLE_LABELS[user.role]}</span>}
          </button>
          {open ? (
            <div
              role="menu"
              id="profile-menu"
              aria-labelledby="profile-btn"
              className="menu"
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
            >
              <p className="t-meta">{title ? `${user.email} · ${title}` : user.email}</p>
              {logout}
            </div>
          ) : null}
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
