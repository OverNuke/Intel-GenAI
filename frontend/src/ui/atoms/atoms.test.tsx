// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
