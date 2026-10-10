// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HealthStatus } from "./health-status";

afterEach(cleanup);

describe("HealthStatus", () => {
  it("shows the available message when the API answers ok", async () => {
    render(<HealthStatus load={async () => ({ ok: true, data: { status: "ok" } })} />);
    expect(await screen.findByText("Servicio disponible")).toBeTruthy();
  });

  it("shows the connection error when the API fails", async () => {
    render(<HealthStatus load={async () => ({ ok: false, status: 500 })} />);
    expect(await screen.findByText("No pudimos conectar con el servicio")).toBeTruthy();
  });

  it("shows a checking state first", () => {
    render(<HealthStatus load={() => new Promise(() => {})} />);
    expect(screen.getByText("Comprobando el servicio…")).toBeTruthy();
  });
});
