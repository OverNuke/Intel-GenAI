import type { components } from "@/lib/api-types";
import { AppShell } from "./app-shell";
import { LogoutButton } from "./logout-button";

type User = components["schemas"]["UserOut"];

const SUBTITLE: Record<User["role"], string> = {
  user: "Estos son tus tickets y lo que puedes pedir hoy.",
  it: "Seguimiento de tickets de la mesa de ayuda.",
  supervisor: "Seguimiento del agente: cómo se usa Ariadna y qué tanto ayuda. Solo tú ves esta sección.",
};

/** Minimal Phase 1 landing for a role's start section (real content arrives in later phases). */
export function SectionPlaceholder({ user, active }: { user: User; active: string }) {
  return (
    <AppShell user={user} active={active} logout={<LogoutButton />}>
      <h1 tabIndex={-1}>Hola, {user.name.split(" ")[0]}</h1>
      <p>{SUBTITLE[user.role]}</p>
    </AppShell>
  );
}
