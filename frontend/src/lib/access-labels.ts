import type { components } from "./api-types";

export type Role = components["schemas"]["RoleOut"]["key"];

/** Start section per role (A1/A2 landing and the A3 "Ir a tu sección" action). */
export const ROLE_HOME: Record<Role, string> = {
  user: "/inicio",
  it: "/ti/seguimiento",
  supervisor: "/supervisor/agente",
};

// Display names only (es-MX). Who may open what stays in the backend policy.
export const ROLE_LABELS: Record<Role, string> = { user: "Usuario", it: "TI", supervisor: "Supervisor" };

/** Role text shown in the A2 account picker (REQ-A2-1). Display only. */
export const PICKER_ROLE_LABELS: Record<Role, string> = {
  user: "Usuario",
  it: "TI (Consultor TI)",
  supervisor: "Supervisor (Supervisora)",
};

const SECTION_LABELS: Record<string, string> = {
  home: "Inicio",
  "my-tickets": "Mis tickets",
  "new-request": "¿Qué necesitas?",
  "my-team": "Mi equipo",
  "ticket-tracking": "Seguimiento de tickets",
  registry: "Registro",
  closure: "Cierre",
  "agent-tracking": "Seguimiento del agente",
};

const GENERIC_DENIED = "No tienes acceso a esta sección.";

const isRole = (value: unknown): value is Role => typeof value === "string" && Object.hasOwn(ROLE_LABELS, value);
const isSection = (value: unknown): value is string => typeof value === "string" && Object.hasOwn(SECTION_LABELS, value);

/** URL of A3 for a policy denial (codes only; A3 renders the copy). */
export function sinAccesoHref(denial: { section: { key: string }; required_role: { key: string } | null }): string {
  const params = new URLSearchParams({ section: denial.section.key });
  if (denial.required_role) params.set("required", denial.required_role.key);
  return `/sin-acceso?${params.toString()}`;
}

/** Validates untrusted query params: unknown values are dropped, never rendered. */
export function parseDenied(query: { section?: unknown; required?: unknown }): { section?: string; required?: Role } {
  const parsed: { section?: string; required?: Role } = {};
  if (isSection(query.section)) parsed.section = query.section;
  if (isRole(query.required)) parsed.required = query.required;
  return parsed;
}

export function deniedSentence(section: string | undefined, required: string | undefined): string {
  if (!isSection(section) || !isRole(required)) return GENERIC_DENIED;
  return `${SECTION_LABELS[section]} es solo para ${ROLE_LABELS[required]}.`;
}
