// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { stageSteps } from "@/lib/ticket-labels";
import { Stepper } from "./stepper";

afterEach(cleanup);

describe("Stepper", () => {
  it("is a named list with one item per step and the state word as text (S-UT-D2)", () => {
    render(<Stepper label="Etapas del ticket" variant="full" steps={stageSteps("in_progress")} />);
    const list = screen.getByRole("list", { name: "Etapas del ticket" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Recibido"),
      expect.stringContaining("Ya lo tiene un especialista"),
      expect.stringContaining("En revisión por TI"),
      expect.stringContaining("Resuelto"),
      expect.stringContaining("Cerrado"),
    ]);
    expect(within(items[0] as HTMLElement).getByText("Completado")).toBeTruthy();
    expect(within(items[2] as HTMLElement).getByText("Paso actual")).toBeTruthy();
    expect(within(items[3] as HTMLElement).getByText("Por venir")).toBeTruthy();
  });

  it("marks exactly one step as the current one for assistive tech", () => {
    const { container } = render(
      <Stepper label="Etapas" variant="vertical" steps={stageSteps("assigned")} />,
    );
    const current = container.querySelectorAll('[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain("Ya lo tiene un especialista");
  });

  it("marks no step as current when every step is done or upcoming", () => {
    const { container } = render(
      <Stepper
        label="Etapas"
        variant="full"
        steps={[
          { label: "Uno", state: "done", word: "Completado" },
          { label: "Dos", state: "upcoming", word: "Por venir" },
        ]}
      />,
    );
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(0);
  });

  it("shows the pending flag as text on its step without adding a stage", () => {
    render(
      <Stepper
        label="Etapas del ticket"
        variant="full"
        steps={[
          { label: "Recibido", state: "done", word: "Completado" },
          { label: "En curso", state: "current", word: "Paso actual", pending: "Pendiente" },
          { label: "Resuelto", state: "upcoming", word: "Por venir" },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    const flag = screen.getByText("Pendiente");
    expect(flag.closest("li")?.textContent).toContain("En curso");
    expect(flag.querySelector('[data-icon="circle-alert"]')).not.toBeNull();
  });

  it("renders the number and the note of a step when given", () => {
    render(
      <Stepper
        label="Pasos"
        variant="vertical"
        steps={[{ label: "Qué pasa", state: "current", word: "Paso actual", num: 1, note: "5 ene 2026, 09:00" }]}
      />,
    );
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("5 ene 2026, 09:00")).toBeTruthy();
  });
});
