// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorSummary } from "./error-summary";
import { FormField } from "./form-field";

afterEach(cleanup);

describe("FormField", () => {
  it("labels the input and shows no error by default", () => {
    render(<FormField id="f-email" label="Correo institucional" />);
    const input = screen.getByLabelText("Correo institucional");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByText("Falta tu correo.")).toBeNull();
  });

  it("ties the error message to the input with aria-invalid and aria-describedby", () => {
    render(<FormField id="f-email" label="Correo institucional" error="Falta tu correo." />);
    const input = screen.getByLabelText("Correo institucional");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const errorId = input.getAttribute("aria-describedby");
    expect(errorId).toBe("f-email-err");
    expect(document.getElementById(errorId!)?.textContent).toContain("Falta tu correo.");
  });

  it("renders trailing content next to the input", () => {
    render(<FormField id="f-pass" label="Contraseña" trailing={<button type="button">Mostrar</button>} />);
    expect(screen.getByRole("button", { name: "Mostrar" })).toBeTruthy();
  });
});

describe("FormField leading icon and field message", () => {
  it("wraps the input in .input-wrap with the leading icon before it", () => {
    render(<FormField id="f-email" label="Correo" leadingIcon="mail" />);
    const input = screen.getByLabelText("Correo");
    const wrap = input.parentElement as HTMLElement;
    expect(wrap.classList.contains("input-wrap")).toBe(true);
    expect(wrap.firstElementChild?.getAttribute("data-icon")).toBe("mail");
    expect(wrap.firstElementChild?.nextElementSibling).toBe(input);
  });

  it("renders no .input-wrap without leadingIcon", () => {
    const { container } = render(<FormField id="f-x" label="X" />);
    expect(container.querySelector(".input-wrap")).toBeNull();
  });

  it("renders the error as p.field-msg.is-error with a 16px circle-alert", () => {
    render(<FormField id="f-email" label="Correo" leadingIcon="mail" error="Falta tu correo." />);
    const input = screen.getByLabelText("Correo");
    const msg = document.getElementById("f-email-err") as HTMLElement;
    expect(msg.tagName).toBe("P");
    expect(msg.classList.contains("field-msg")).toBe(true);
    expect(msg.classList.contains("is-error")).toBe(true);
    const svg = msg.querySelector("svg");
    expect(svg?.getAttribute("data-icon")).toBe("circle-alert");
    expect(svg?.classList.contains("icon-16")).toBe(true);
    expect(msg.textContent).toBe("Falta tu correo.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("f-email-err");
  });
});

describe("ErrorSummary", () => {
  it("is a tone-error alert with a circle-alert icon", () => {
    render(<ErrorSummary message="Algo falló." />);
    const alert = screen.getByRole("alert");
    expect(alert.classList.contains("alert")).toBe(true);
    expect(alert.classList.contains("tone-error")).toBe(true);
    expect(alert.querySelector("svg")?.getAttribute("data-icon")).toBe("circle-alert");
  });

  const items = [
    { fieldId: "f-email", message: "Falta tu correo." },
    { fieldId: "f-pass", message: "Falta tu contraseña." },
  ];

  it("is an alert that takes focus on mount, with a heading and a link per error", () => {
    render(<ErrorSummary items={items} />);
    const alert = screen.getByRole("alert");
    expect(document.activeElement).toBe(alert);
    expect(alert.getAttribute("tabindex")).toBe("-1");
    expect(alert.textContent).toContain("Revisa lo siguiente:");
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Falta tu correo.", "Falta tu contraseña."]);
  });

  it("moves focus to the offending field when a link is activated", () => {
    render(
      <>
        <ErrorSummary items={items} />
        <input id="f-email" aria-label="e" />
        <input id="f-pass" aria-label="p" />
      </>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Falta tu contraseña." }));
    expect(document.activeElement).toBe(document.getElementById("f-pass"));
  });

  it("shows a plain message (no links, no heading) when there are no field errors", () => {
    render(<ErrorSummary message="No pudimos iniciar sesión con esos datos." />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("No pudimos iniciar sesión con esos datos.");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(document.activeElement).toBe(alert);
  });
});
