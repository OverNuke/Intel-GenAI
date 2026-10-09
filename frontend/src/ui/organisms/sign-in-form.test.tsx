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
