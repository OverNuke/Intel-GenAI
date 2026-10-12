// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { SignInForm, type SignInFormProps } from "./sign-in-form";

type User = components["schemas"]["UserOut"];
type LoginErrors = components["schemas"]["LoginErrors"];
type LoginResult = ApiResult<User, LoginErrors>;

afterEach(cleanup);

const ana: User = { id: "1", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" };
const luis: User = { id: "2", name: "Luis Herrera", email: "luis.herrera@ejemplo.mx", area: "Mesa de ayuda", role: "it" };
const sara: User = { id: "3", name: "Sara Molina", email: "sara.molina@ejemplo.mx", area: "Supervisión", role: "supervisor" };
const accounts = [ana, luis, sara];

function setup(result: LoginResult = { ok: true, data: ana }) {
  const login = vi.fn<SignInFormProps["login"]>(async () => result);
  const onSignedIn = vi.fn();
  render(<SignInForm accounts={accounts} login={login} onSignedIn={onSignedIn} />);
  return { login, onSignedIn };
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

describe("A1 sign-in view", () => {
  it("shows the static copy", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Inicia sesión" })).toBeTruthy();
    expect(screen.getByText("Usa tu correo institucional.")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toBe("Esto es un prototipo. No escribas tus datos reales.");
    expect(screen.getByText("Datos de ejemplo: ana.ruiz@ejemplo.mx · contraseña demo2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver al inicio" }).getAttribute("href")).toBe("/");
  });

  it("S-A1-1: empty submit shows both inline errors and a focused summary, no request", () => {
    const { login } = setup();
    submit();
    const alert = screen.getByRole("alert");
    expect(document.activeElement).toBe(alert);
    expect(alert.textContent).toContain("Revisa lo siguiente:");
    expect(screen.getAllByText("Falta tu correo. Escríbelo así: nombre@empresa.mx")).toHaveLength(2);
    expect(screen.getAllByText("Falta tu contraseña. Escríbela para continuar.")).toHaveLength(2);
    const email = screen.getByLabelText("Correo institucional");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.getAttribute("aria-describedby")).toBe("f-email-err");
    expect(login).not.toHaveBeenCalled();
  });

  it("S-A1-2: a malformed email gets the incomplete-email message", () => {
    const { login } = setup();
    type("Correo institucional", "ana");
    type("Contraseña", "x");
    submit();
    expect(screen.getAllByText("El correo no parece completo. Revisa que tenga @ y el dominio.")).toHaveLength(2);
    expect(screen.queryByText("Falta tu contraseña. Escríbela para continuar.")).toBeNull();
    expect(login).not.toHaveBeenCalled();
  });

  it("S-A1-5: a summary link moves focus to its field", () => {
    setup();
    submit();
    fireEvent.click(screen.getByRole("link", { name: "Falta tu contraseña. Escríbela para continuar." }));
    expect(document.activeElement).toBe(screen.getByLabelText("Contraseña"));
  });

  it("S-A1-3: demo data fills the fields without submitting, then submit signs in", async () => {
    const { login, onSignedIn } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Usar datos de ejemplo" }));
    expect((screen.getByLabelText("Correo institucional") as HTMLInputElement).value).toBe("ana.ruiz@ejemplo.mx");
    expect((screen.getByLabelText("Contraseña") as HTMLInputElement).value).toBe("demo2026");
    expect(login).not.toHaveBeenCalled();
    submit();
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(ana));
    expect(login).toHaveBeenCalledWith({ method: "credentials", email: "ana.ruiz@ejemplo.mx", password: "demo2026" });
  });

  it("trims the email before sending", async () => {
    const { login } = setup();
    type("Correo institucional", "  ana.ruiz@ejemplo.mx ");
    type("Contraseña", "demo2026");
    submit();
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledWith({ method: "credentials", email: "ana.ruiz@ejemplo.mx", password: "demo2026" });
  });

  it("S-A1-4: a 401 shows the generic message, keeps the email and does not sign in", async () => {
    const { onSignedIn } = setup({
      ok: false,
      status: 401,
      error: { errors: [{ field: "form", code: "invalid_credentials" }] },
    });
    type("Correo institucional", "ana.ruiz@ejemplo.mx");
    type("Contraseña", "mal");
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "No pudimos iniciar sesión con esos datos. Revisa el correo y la contraseña, o usa los datos de ejemplo.",
    );
    expect(document.activeElement).toBe(alert);
    expect((screen.getByLabelText("Correo institucional") as HTMLInputElement).value).toBe("ana.ruiz@ejemplo.mx");
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("shows a connection message when the service does not answer", async () => {
    setup({ ok: false, status: 0 });
    type("Correo institucional", "ana.ruiz@ejemplo.mx");
    type("Contraseña", "demo2026");
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe("No pudimos conectar con el servicio. Inténtalo de nuevo.");
  });

  it("shows the busy label while the request is pending", async () => {
    const login = vi.fn(() => new Promise<LoginResult>(() => {}));
    render(<SignInForm accounts={accounts} login={login} onSignedIn={vi.fn()} />);
    type("Correo institucional", "ana.ruiz@ejemplo.mx");
    type("Contraseña", "demo2026");
    submit();
    const busy = await screen.findByRole("button", { name: "Entrando…" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
  });

  it("stays busy after a successful sign-in so a second tap cannot fire while the role home loads", async () => {
    const { login, onSignedIn } = setup();
    type("Correo institucional", "ana.ruiz@ejemplo.mx");
    type("Contraseña", "demo2026");
    submit();
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    const busy = screen.getByRole("button", { name: "Entrando…" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(busy);
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("S-A1-6: the forgot-password button announces the prototype message and stays on A1", () => {
    setup();
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "¿Olvidaste tu contraseña?" }));
    expect(screen.getByRole("status").textContent).toBe(
      "En este prototipo no se restablecen contraseñas. En la mesa de ayuda real, contacta a Soporte TI.",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Inicia sesión" })).toBeTruthy();
  });

  it("REQ-A1-9: Mostrar toggles masking without losing the value", () => {
    setup();
    const password = screen.getByLabelText("Contraseña") as HTMLInputElement;
    type("Contraseña", "secreto");
    expect(password.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(password.type).toBe("text");
    expect(password.value).toBe("secreto");
    expect(screen.getByRole("button", { name: "Mostrar" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("A1 rebuilt layout (REQ-A1-M1..M5)", () => {
  const icon = (el: Element | null, name: string) => el?.querySelector(`svg[data-icon="${name}"]`) ?? null;

  it("S-A1-M1: SSO is the only primary, with building-2; sign-in is a secondary block", () => {
    setup();
    const primaries = document.querySelectorAll(".btn-primary");
    expect(primaries).toHaveLength(1);
    const sso = screen.getByRole("button", { name: "Entrar con la cuenta de la organización" });
    expect(sso).toBe(primaries[0]);
    expect(sso.classList.contains("btn-block")).toBe(true);
    expect(icon(sso, "building-2")).not.toBeNull();
    const login = screen.getByRole("button", { name: "Iniciar sesión" });
    expect(login.classList.contains("btn-secondary")).toBe(true);
    expect(login.classList.contains("btn-block")).toBe(true);
    expect(screen.getByRole("button", { name: "Usar datos de ejemplo" }).classList.contains("btn-secondary")).toBe(true);
  });

  it("shows busy label 'Entrando…' on the sign-in button while pending, still one primary", async () => {
    const login = vi.fn(() => new Promise<LoginResult>(() => {}));
    render(<SignInForm accounts={accounts} login={login} onSignedIn={vi.fn()} />);
    type("Correo institucional", "ana.ruiz@ejemplo.mx");
    type("Contraseña", "demo2026");
    submit();
    await screen.findByRole("button", { name: "Entrando…" });
    expect(document.querySelectorAll(".btn-primary")).toHaveLength(1);
  });

  it("puts mail and lock leading icons inside the input wraps", () => {
    setup();
    const email = screen.getByLabelText("Correo institucional");
    const pass = screen.getByLabelText("Contraseña");
    expect(email.parentElement?.classList.contains("input-wrap")).toBe(true);
    expect(icon(email.parentElement, "mail")).not.toBeNull();
    expect(pass.parentElement?.classList.contains("input-wrap")).toBe(true);
    expect(icon(pass.parentElement, "lock")).not.toBeNull();
  });

  it("Mostrar keeps its accessible name and aria-pressed while the icon swaps eye <-> eye-off", () => {
    setup();
    const toggle = screen.getByRole("button", { name: "Mostrar" });
    expect(icon(toggle, "eye")).not.toBeNull();
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    const after = screen.getByRole("button", { name: "Mostrar" });
    expect(after.getAttribute("aria-pressed")).toBe("true");
    expect(icon(after, "eye-off")).not.toBeNull();
    expect(icon(after, "eye")).toBeNull();
    expect((screen.getByLabelText("Contraseña") as HTMLInputElement).type).toBe("text");
  });

  it("Volver al inicio is a ghost link with arrow-left", () => {
    setup();
    const back = screen.getByRole("link", { name: "Volver al inicio" });
    expect(back.classList.contains("btn")).toBe(true);
    expect(back.classList.contains("btn-ghost")).toBe(true);
    expect(icon(back, "arrow-left")).not.toBeNull();
  });

  it("the prototype note is an info Alert with the info icon", () => {
    setup();
    const note = screen.getByRole("note");
    expect(note.classList.contains("alert")).toBe(true);
    expect(note.classList.contains("tone-info")).toBe(true);
    expect(icon(note, "info")).not.toBeNull();
  });

  it("the divider is .or-divider labelled «o»", () => {
    setup();
    const divider = screen.getByRole("separator", { name: "o" });
    expect(divider.classList.contains("or-divider")).toBe(true);
  });
});

describe("A1 merged error alert (REQ-A1-M5, S-A1-M2)", () => {
  it("empty submit: one focused error alert with circle-alert; each field error has circle-alert; no request", () => {
    const { login } = setup();
    submit();
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    const alert = alerts[0]!;
    expect(alert.classList.contains("tone-error")).toBe(true);
    expect(alert.querySelector('svg[data-icon="circle-alert"]')).not.toBeNull();
    expect(document.activeElement).toBe(alert);
    const msgs = document.querySelectorAll("p.field-msg.is-error");
    expect(msgs).toHaveLength(2);
    for (const msg of msgs) expect(msg.querySelector('svg[data-icon="circle-alert"]')).not.toBeNull();
    expect(login).not.toHaveBeenCalled();
  });

  it("wrong credentials use the same error alert", async () => {
    setup({ ok: false, status: 401, error: { errors: [{ field: "form", code: "invalid_credentials" }] } });
    type("Correo institucional", "ana.ruiz@ejemplo.mx");
    type("Contraseña", "mal");
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.classList.contains("tone-error")).toBe(true);
    expect(alert.querySelector('svg[data-icon="circle-alert"]')).not.toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});

describe("A2 account picker state", () => {
  const openPicker = () => fireEvent.click(screen.getByRole("button", { name: "Entrar con la cuenta de la organización" }));

  it("opens from the SSO button and lists exactly the fetched accounts", () => {
    setup();
    openPicker();
    const heading = screen.getByRole("heading", { level: 1, name: "Elige tu cuenta" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("Cuenta de la organización. Cada cuenta abre la sección de su rol.")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toBe("Esto es un prototipo: son cuentas de ejemplo.");
    const list = screen.getByRole("list", { name: "Cuentas de ejemplo" });
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[1]!.textContent).toContain("Luis Herrera");
    expect(items[1]!.textContent).toContain("luis.herrera@ejemplo.mx · Mesa de ayuda");
    expect(within(items[0]!).getByText("Usuario")).toBeTruthy();
    expect(within(items[1]!).getByText("TI (Consultor TI)")).toBeTruthy();
    expect(within(items[2]!).getByText("Supervisor (Supervisora)")).toBeTruthy();
  });

  it("renders only the accounts it receives (nothing hardcoded)", () => {
    const login = vi.fn();
    render(<SignInForm accounts={[luis]} login={login} onSignedIn={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar con la cuenta de la organización" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Ana Ruiz")).toBeNull();
  });

  it("S-A2-1: choosing an account posts its email and reports the signed-in user", async () => {
    const { login, onSignedIn } = setup({ ok: true, data: sara });
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: /Sara Molina/ }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(sara));
    expect(login).toHaveBeenCalledWith({ method: "account", email: "sara.molina@ejemplo.mx" });
  });

  it("shows an alert when the account login fails", async () => {
    const { onSignedIn } = setup({ ok: false, status: 0 });
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: /Luis Herrera/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("No pudimos conectar con el servicio. Inténtalo de nuevo.");
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("shows a decorative initials avatar before each name", () => {
    setup();
    openPicker();
    const items = screen.getByRole("list", { name: "Cuentas de ejemplo" }).querySelectorAll("li");
    const avatar = items[0]!.querySelector(".account-avatar");
    expect(avatar?.textContent).toBe("AR");
    expect(avatar?.getAttribute("aria-hidden")).toBe("true");
    expect(items[2]!.querySelector(".account-avatar")?.textContent).toBe("SM");
  });

  it("marks only the chosen row busy ('Entrando…') and disables the others while the request is pending", async () => {
    const login = vi.fn(() => new Promise<LoginResult>(() => {}));
    render(<SignInForm accounts={accounts} login={login} onSignedIn={vi.fn()} />);
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: /Luis Herrera/ }));
    const items = screen.getByRole("list", { name: "Cuentas de ejemplo" }).querySelectorAll("li");
    const chosen = items[1]!.querySelector("button")!;
    expect(chosen.getAttribute("aria-busy")).toBe("true");
    expect(chosen.textContent).toContain("Entrando…");
    expect(items[0]!.querySelector("button")!.hasAttribute("disabled")).toBe(true);
    expect(items[0]!.querySelector("button")!.getAttribute("aria-busy")).toBeNull();
    expect(items[0]!.textContent).not.toContain("Entrando…");
    expect(items[2]!.querySelector("button")!.hasAttribute("disabled")).toBe(true);
  });

  it("S-A2-2: Usar otra cuenta returns to A1 with the heading focused", () => {
    setup();
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "Usar otra cuenta" }));
    const heading = screen.getByRole("heading", { level: 1, name: "Inicia sesión" });
    expect(document.activeElement).toBe(heading);
  });
});

describe("accounts unavailable", () => {
  it("disables the picker with a notice but keeps credentials login working", async () => {
    const login = vi.fn<SignInFormProps["login"]>(async () => ({ ok: true, data: ana }));
    const onSignedIn = vi.fn();
    render(<SignInForm accounts={null} login={login} onSignedIn={onSignedIn} />);
    const sso = screen.getByRole("button", { name: "Entrar con la cuenta de la organización" });
    expect(sso.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(sso);
    expect(screen.getByRole("heading", { level: 1, name: "Inicia sesión" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Cuentas de ejemplo" })).toBeNull();
    expect(
      screen.getByText("No pudimos cargar las cuentas de ejemplo. Puedes iniciar sesión con tu correo y contraseña."),
    ).toBeTruthy();
    type("Correo institucional", "ana.ruiz@ejemplo.mx");
    type("Contraseña", "demo2026");
    submit();
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(ana));
  });

  it("does not show the notice when accounts loaded", () => {
    setup();
    expect(screen.queryByText(/No pudimos cargar las cuentas/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Entrar con la cuenta de la organización" }).getAttribute("aria-disabled"),
    ).toBeNull();
  });
});
