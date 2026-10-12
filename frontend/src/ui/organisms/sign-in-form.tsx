"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PICKER_ROLE_LABELS } from "@/lib/access-labels";
import type { ApiResult } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { initialsOf } from "@/lib/initials";
import { Alert } from "../atoms/alert";
import { Badge } from "../atoms/badge";
import { Button } from "../atoms/button";
import { Icon } from "../atoms/icon";
import { ErrorSummary, type SummaryItem } from "../molecules/error-summary";
import { FormField } from "../molecules/form-field";

type User = components["schemas"]["UserOut"];
type LoginErrors = components["schemas"]["LoginErrors"];
type LoginBody = components["schemas"]["LoginRequestBody"];

export type SignInFormProps = {
  /** `null` when the accounts list could not be loaded: the picker is disabled, credentials still work. */
  accounts: User[] | null;
  login: (body: LoginBody) => Promise<ApiResult<User, LoginErrors>>;
  onSignedIn: (user: User) => void;
};

const DEMO = { email: "ana.ruiz@ejemplo.mx", password: "demo2026" };
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
  emailMissing: "Falta tu correo. Escríbelo así: nombre@empresa.mx",
  emailInvalid: "El correo no parece completo. Revisa que tenga @ y el dominio.",
  passwordMissing: "Falta tu contraseña. Escríbela para continuar.",
  rejected: "No pudimos iniciar sesión con esos datos. Revisa el correo y la contraseña, o usa los datos de ejemplo.",
  unavailable: "No pudimos conectar con el servicio. Inténtalo de nuevo.",
  accountsUnavailable: "No pudimos cargar las cuentas de ejemplo. Puedes iniciar sesión con tu correo y contraseña.",
  forgot: "En este prototipo no se restablecen contraseñas. En la mesa de ayuda real, contacta a Soporte TI.",
} as const;

type FieldErrors = { email?: string; password?: string };

/** Pure: validation on submit, email trimmed. */
export function validateCredentials(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = email.trim();
  if (!trimmed) errors.email = COPY.emailMissing;
  else if (!EMAIL_SHAPE.test(trimmed)) errors.email = COPY.emailInvalid;
  if (!password) errors.password = COPY.passwordMissing;
  return errors;
}

export function SignInForm({ accounts, login, onSignedIn }: SignInFormProps) {
  const [view, setView] = useState<"login" | "chooser">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewChanged = useRef(false);

  useEffect(() => {
    if (viewChanged.current) headingRef.current?.focus();
  }, [view]);

  function switchView(next: "login" | "chooser") {
    viewChanged.current = true;
    setFailure(null);
    setFieldErrors({});
    setView(next);
  }

  async function run(body: LoginBody) {
    setBusy(true);
    setBusyEmail(body.method === "account" ? (body.email ?? null) : null);
    setFailure(null);
    const result = await login(body);
    if (result.ok) {
      // Stay busy until the role home replaces this page: an idle button invites repeat taps.
      onSignedIn(result.data);
      return;
    }
    setBusy(false);
    setBusyEmail(null);
    setAttempt((n) => n + 1);
    setFailure(result.status === 400 || result.status === 401 ? COPY.rejected : COPY.unavailable);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const errors = validateCredentials(email, password);
    setFieldErrors(errors);
    setAttempt((n) => n + 1);
    if (errors.email || errors.password) {
      setFailure(null);
      return;
    }
    void run({ method: "credentials", email: email.trim(), password });
  }

  const items: SummaryItem[] = [];
  if (fieldErrors.email) items.push({ fieldId: "f-email", message: fieldErrors.email });
  if (fieldErrors.password) items.push({ fieldId: "f-pass", message: fieldErrors.password });

  if (view === "chooser") {
    return (
      <section aria-labelledby="chooser-title" className="stack">
        <h1 id="chooser-title" ref={headingRef} tabIndex={-1}>
          Elige tu cuenta
        </h1>
        <p>Cuenta de la organización. Cada cuenta abre la sección de su rol.</p>
        <Alert tone="info" role="note">
          <p>Esto es un prototipo: son cuentas de ejemplo.</p>
        </Alert>
        {failure ? <ErrorSummary key={attempt} message={failure} /> : null}
        <ul aria-label="Cuentas de ejemplo" className="account-list">
          {(accounts ?? []).map((account) => {
            const chosen = busy && busyEmail === account.email;
            return (
              <li key={account.id}>
                <button
                  type="button"
                  className="account-option"
                  disabled={busy}
                  aria-busy={chosen ? "true" : undefined}
                  onClick={() => void run({ method: "account", email: account.email })}
                >
                  <span className="account-avatar" aria-hidden="true">
                    {initialsOf(account.name)}
                  </span>
                  <span className="account-body">
                    <span className="account-name">{account.name}</span>
                    <span className="t-meta">
                      {account.email} · {account.area}
                    </span>
                  </span>
                  {chosen ? <span className="t-meta">Entrando…</span> : <Badge>{PICKER_ROLE_LABELS[account.role]}</Badge>}
                </button>
              </li>
            );
          })}
        </ul>
        <Button variant="ghost" onClick={() => switchView("login")}>
          Usar otra cuenta
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="login-title" className="stack">
      <Link href="/" className="btn btn-ghost">
        <Icon name="arrow-left" />
        Volver al inicio
      </Link>
      <h1 id="login-title" ref={headingRef} tabIndex={-1}>
        Inicia sesión
      </h1>
      <p>Usa tu correo institucional.</p>
      <Alert tone="info" role="note">
        <p>Esto es un prototipo. No escribas tus datos reales.</p>
      </Alert>
      <div className="stack">
        <p className="t-meta">
          Datos de ejemplo: {DEMO.email} · contraseña {DEMO.password}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setEmail(DEMO.email);
            setPassword(DEMO.password);
            setFieldErrors({});
            setFailure(null);
          }}
        >
          Usar datos de ejemplo
        </Button>
      </div>
      <Button
        className="btn-block"
        aria-disabled={accounts ? undefined : "true"}
        onClick={() => {
          if (accounts) switchView("chooser");
        }}
      >
        <Icon name="building-2" />
        Entrar con la cuenta de la organización
      </Button>
      {accounts ? null : <p className="t-meta">{COPY.accountsUnavailable}</p>}
      <div role="separator" aria-label="o" className="or-divider">
        o
      </div>
      {items.length > 0 ? <ErrorSummary key={attempt} items={items} /> : null}
      {failure ? <ErrorSummary key={attempt} message={failure} /> : null}
      <form noValidate aria-labelledby="login-title" onSubmit={onSubmit} className="stack">
        <FormField
          id="f-email"
          label="Correo institucional"
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          leadingIcon="mail"
        />
        <FormField
          id="f-pass"
          label="Contraseña"
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          leadingIcon="lock"
          trailing={
            <Button
              variant="ghost"
              aria-pressed={showPassword}
              aria-controls="f-pass"
              onClick={() => setShowPassword((v) => !v)}
            >
              <Icon name={showPassword ? "eye-off" : "eye"} />
              Mostrar
            </Button>
          }
        />
        <Button
          variant="ghost"
          aria-expanded={showForgot}
          aria-controls="forgot-note"
          onClick={() => setShowForgot((v) => !v)}
        >
          ¿Olvidaste tu contraseña?
        </Button>
        {showForgot ? (
          <p id="forgot-note" role="status">
            {COPY.forgot}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" className="btn-block" busy={busy} busyLabel="Entrando…">
          Iniciar sesión
        </Button>
      </form>
    </section>
  );
}
