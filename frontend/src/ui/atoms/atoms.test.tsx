// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Alert } from "./alert";
import { Badge } from "./badge";
import { Button } from "./button";
import { TextInput } from "./text-input";

afterEach(cleanup);

describe("Button", () => {
  it("renders its label and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Iniciar sesión</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows the busy label, sets aria-busy and ignores clicks while busy", () => {
    const onClick = vi.fn();
    render(
      <Button busy busyLabel="Entrando…" onClick={onClick}>
        Iniciar sesión
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Entrando…" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is not busy by default", () => {
    render(<Button>Volver</Button>);
    expect(screen.getByRole("button", { name: "Volver" }).getAttribute("aria-busy")).toBeNull();
  });
});

describe("TextInput", () => {
  it("reports invalid state and the error id it points to", () => {
    render(<TextInput id="f-email" aria-label="Correo" invalid describedBy="f-email-err" />);
    const input = screen.getByLabelText("Correo");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("f-email-err");
  });

  it("has no aria-invalid when valid", () => {
    render(<TextInput id="f" aria-label="Correo" />);
    const input = screen.getByLabelText("Correo");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });
});

describe("Badge", () => {
  it("renders its text", () => {
    render(<Badge>Supervisor</Badge>);
    expect(screen.getByText("Supervisor")).toBeTruthy();
  });
});

describe("Alert", () => {
  it.each([
    ["info", "info"],
    ["error", "circle-alert"],
    ["warning", "triangle-alert"],
    ["success", "circle-check"],
  ] as const)("renders tone-%s with the %s icon, aria-hidden", (tone, icon) => {
    const { container } = render(<Alert tone={tone}>Mensaje</Alert>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("alert")).toBe(true);
    expect(root.classList.contains(`tone-${tone}`)).toBe(true);
    const svg = root.querySelector("svg[data-icon]");
    expect(svg?.getAttribute("data-icon")).toBe(icon);
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(root.textContent).toBe("Mensaje");
  });

  it("honors icon and role overrides", () => {
    render(
      <Alert tone="info" icon="mail" role="note">
        Aviso
      </Alert>,
    );
    const note = screen.getByRole("note");
    expect(note.querySelector("svg")?.getAttribute("data-icon")).toBe("mail");
  });

  it("forwards ref and extra props", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <Alert tone="error" role="alert" ref={ref} tabIndex={-1}>
        Error
      </Alert>,
    );
    expect(ref.current).toBe(screen.getByRole("alert"));
    expect(ref.current?.getAttribute("tabindex")).toBe("-1");
  });
});
