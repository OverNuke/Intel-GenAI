// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductShot } from "./product-shot";

afterEach(cleanup);

const LABELS = {
  conversation: "Ejemplo de la conversación con Ariadna: una persona cuenta su problema y Ariadna le hace una pregunta",
  confirmation: "Ejemplo de la tarjeta de confirmación: a dónde iría la solicitud y qué falta antes de enviarla",
} as const;

describe("ProductShot", () => {
  for (const variant of ["conversation", "confirmation"] as const) {
    describe(variant, () => {
      it("is one image with an es-MX label and a visible 'Datos de ejemplo' caption", () => {
        render(<ProductShot variant={variant} />);
        const figure = screen.getByRole("img", { name: LABELS[variant] });
        expect(figure.tagName).toBe("FIGURE");
        const caption = figure.querySelector("figcaption");
        expect(caption?.textContent).toBe("Datos de ejemplo");
        expect(caption?.closest("[aria-hidden='true']")).toBeNull();
      });

      it("renders the product UI inert and hidden from assistive tech, with nothing interactive", () => {
        const { container } = render(<ProductShot variant={variant} />);
        const inner = container.querySelector("figure > [aria-hidden='true']");
        expect(inner).not.toBeNull();
        expect(inner?.hasAttribute("inert")).toBe(true);
        expect(container.querySelector("button, input, a, select, textarea, [tabindex]")).toBeNull();
      });
    });
  }

  it("conversation: a plain-words problem, the follow-up question, option pills and step 2 of 5", () => {
    const { container } = render(<ProductShot variant="conversation" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Mi computadora no abre el sistema de nóminas");
    expect(text).toContain("¿Desde cuándo te pasa?");
    expect(text).toContain("Desde hoy");
    expect(text).toContain("Desde esta semana");
    for (const step of ["Qué pasa", "Detalles", "Adjuntos", "Revisión", "Enviado"]) expect(text).toContain(step);
    const current = container.querySelector("li[aria-current='step']");
    expect(current?.textContent).toContain("Detalles");
  });

  it("confirmation: destination group, what is missing, nothing sent, and look-alike buttons", () => {
    const { container } = render(<ProductShot variant="confirmation" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Lo enviaríamos a");
    expect(text).toContain("Soporte a equipos");
    expect(text).toContain("Te falta");
    expect(text).toContain("Todavía no se ha enviado nada");
    expect(text).toContain("Seguir después");
    expect(text).toContain("Revisar y enviar");
    expect(text).toContain("Prioridad estimada");
  });

  it("exposes only the figure to the accessibility tree", () => {
    render(<ProductShot variant="confirmation" />);
    const figure = screen.getByRole("img");
    expect(within(figure).queryAllByRole("button")).toHaveLength(0);
  });
});
