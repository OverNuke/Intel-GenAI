"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/access-labels";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { Icon, type IconName } from "../atoms/icon";

type User = components["schemas"]["UserOut"];
type Role = User["role"];
type Variant = "default" | "chat";

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

const LIVE_ICON: Record<Role, IconName> = { user: "house", it: "inbox", supervisor: "chart-column" };

/**
 * Icon + visible label. The label stays in the accessibility tree at every width (it is only
 * visually hidden when the rail collapses); `data-tooltip` is a CSS-only hint, never a second name.
 */
function RailLink({ href, label, icon, current }: { href: string; label: string; icon: IconName; current: boolean }) {
  return (
    <li>
      <Link href={href} className="rail-item" data-tooltip={label} aria-current={current ? "page" : undefined}>
        <Icon name={icon} />
        <span className="rail-label">{label}</span>
      </Link>
    </li>
  );
}

/** Focusable but inert: keyboard users reach the tooltip and hear the next-stage description. */
function Disabled({ label, icon }: { label: string; icon: IconName }) {
  return (
    <li>
      <button type="button" className="rail-item" data-tooltip={label} aria-disabled="true" aria-describedby="rail-next">
        <Icon name={icon} />
        <span className="rail-label">{label}</span>
      </button>
    </li>
  );
}

/** Own-ticket destinations, live for every role; "Mi equipo" (U5) stays a placeholder. */
function OwnItems({ active }: { active: string }) {
  return (
    <>
      <RailLink href="/tickets" label={COPY.myTickets} icon="ticket" current={active === "my-tickets"} />
      <RailLink href="/solicitud" label={COPY.whatDoYouNeed} icon="layout-grid" current={active === "new-request"} />
      <Disabled label={COPY.myTeam} icon="laptop" />
      <li id="rail-next" className="t-meta">
        {COPY.nextStage}
      </li>
    </>
  );
}

/**
 * The single "Secciones" landmark. Same markup in both variants: the default is the sticky rail,
 * the chat variant (U6) is the floating `.islands` pill. Never rendered twice.
 */
function Rail({ user, active, variant }: { user: User; active: string; variant: Variant }) {
  const live = LIVE_SECTION[user.role];
  return (
    <nav aria-label="Secciones" className={`${variant === "chat" ? "islands" : "rail"} nav-sections`}>
      <ul>
        <RailLink href={ROLE_HOME[user.role]} label={live.label} icon={LIVE_ICON[user.role]} current={active === live.key} />
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
  /** `chat` (U6 only): the rail becomes a floating icon pill so the conversation gets the width. */
  variant?: Variant;
  children: ReactNode;
};

export function AppShell({ user, active, logout, variant = "default", children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const title = ROLE_TITLE[user.role];

  return (
    <div className={variant === "chat" ? "app is-chat" : "app"}>
      <Rail user={user} active={active} variant={variant} />
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
            <Icon name={open ? "chevron-up" : "chevron-down"} size="sm" />
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
