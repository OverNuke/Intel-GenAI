"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/access-labels";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";

type User = components["schemas"]["UserOut"];
type Role = User["role"];

const ORG = "Centro Administrativo Regional Sur";

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

function RailLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <li>
      <Link href={href} className="rail-item" aria-current={current ? "page" : undefined}>
        {label}
      </Link>
    </li>
  );
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

/** Own-ticket destinations, live for every role; "Mi equipo" (U5) stays a placeholder. */
function OwnItems({ active }: { active: string }) {
  return (
    <>
      <RailLink href="/tickets" label={COPY.myTickets} current={active === "my-tickets"} />
      <RailLink href="/solicitud" label={COPY.whatDoYouNeed} current={active === "new-request"} />
      <Disabled label={COPY.myTeam} />
      <li className="t-meta">{COPY.nextStage}</li>
    </>
  );
}

function Rail({ user, active }: { user: User; active: string }) {
  const live = LIVE_SECTION[user.role];
  return (
    <nav aria-label="Secciones" className="rail">
      <ul>
        <RailLink href={ROLE_HOME[user.role]} label={live.label} current={active === live.key} />
        {user.role === "user" ? (
          <OwnItems active={active} />
        ) : (
          <li>
            <ul role="group" aria-labelledby="rail-own">
              <li id="rail-own" className="t-meta">
                Tus propios tickets
              </li>
              <OwnItems active={active} />
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
