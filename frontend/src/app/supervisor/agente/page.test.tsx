// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccess, serverGet } = vi.hoisted(() => ({ requireAccess: vi.fn(), serverGet: vi.fn() }));
vi.mock("@/lib/guard", () => ({ requireAccess }));
vi.mock("@/lib/server-context", () => ({ readServerContext: async () => ({ origin: "http://o", cookie: "c=1" }) }));
vi.mock("@/lib/server-api", () => ({ serverGet }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import SupervisorAgentePage from "./page";

const sara = { id: "sara", name: "Sara Molina", email: "sara.molina@ejemplo.mx", area: "Supervisión", role: "supervisor" };
const report = (period: 7 | 30) => ({
  period,
  sample: true,
  measured: [
    { kind: "measured", key: "passed_to_it", label: "Pasados a TI desde la conversación", value: 8, unit: "count", description: "d" },
  ],
  estimated: {
    label: "Estimaciones, no son resultados medidos",
    metrics: [
      {
        kind: "estimated",
        key: "time_saved",
        label: "Tiempo ahorrado (estimado)",
        value: 28,
        unit: "minutes",
        basis: "b",
        disclaimer: "no son resultados medidos",
      },
    ],
  },
  trend: Array.from({ length: period }, (_, i) => ({ day: i + 1, adoption: 60, corrected: 15 })),
});

beforeEach(() => {
  requireAccess.mockReset();
  serverGet.mockReset();
  requireAccess.mockResolvedValue({ kind: "allowed", user: sara, section: { key: "agent-tracking", label: "x" } });
  serverGet.mockImplementation(async (_path: string, _p: unknown, _c: unknown, _f: unknown, query: { period: string }) => ({
    ok: true,
    data: report(query.period === "30" ? 30 : 7),
  }));
});
afterEach(cleanup);

const search = (q: Record<string, string | string[]>) => Promise.resolve(q);

describe("/supervisor/agente (S1)", () => {
  it("S-AS-4: guards 'agent-tracking', reads both periods and renders S1 (not the placeholder)", async () => {
    render(await SupervisorAgentePage({ searchParams: search({}) }));
    expect(requireAccess).toHaveBeenCalledWith("agent-tracking");
    const periods = serverGet.mock.calls.map((c) => (c[4] as { period: string }).period).sort();
    expect(periods).toEqual(["30", "7"]);
    expect(serverGet.mock.calls[0]![0]).toBe("/api/metrics/agent");
    expect(screen.getByRole("heading", { level: 1, name: "Seguimiento del agente" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "7 días" })).toHaveProperty("checked", true);
    expect(screen.getAllByText("Estimaciones, no son resultados medidos").length).toBeGreaterThan(0);
  });

  it("?periodo=30 starts on 30 days; an invalid value falls back to 7", async () => {
    render(await SupervisorAgentePage({ searchParams: search({ periodo: "30" }) }));
    expect(screen.getByRole("radio", { name: "30 días" })).toHaveProperty("checked", true);
    cleanup();
    render(await SupervisorAgentePage({ searchParams: search({ periodo: "14" }) }));
    expect(screen.getByRole("radio", { name: "7 días" })).toHaveProperty("checked", true);
  });

  it("S-A3-4: a guard redirect propagates and nothing is fetched", async () => {
    requireAccess.mockRejectedValue(new Error("NEXT_REDIRECT:/sin-acceso"));
    await expect(SupervisorAgentePage({ searchParams: search({}) })).rejects.toThrow("NEXT_REDIRECT");
    expect(serverGet).not.toHaveBeenCalled();
  });

  it("a backend failure goes to the retry boundary", async () => {
    serverGet.mockResolvedValue({ ok: false, status: 500 });
    await expect(SupervisorAgentePage({ searchParams: search({}) })).rejects.toThrow(/500/);
  });
});
