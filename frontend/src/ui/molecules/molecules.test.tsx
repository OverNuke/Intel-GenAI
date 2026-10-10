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

describe("ErrorSummary", () => {
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
