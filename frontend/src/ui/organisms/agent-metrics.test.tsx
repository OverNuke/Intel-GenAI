// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { AgentMetricsContainer } from "./agent-metrics-container";
import { EstimatedBlock } from "./estimated-block";
import { MeasuredBlock } from "./measured-block";
import { PeriodSwitch } from "./period-switch";
import { TrendChart } from "./trend-chart";
import { TrendTable } from "./trend-table";

afterEach(cleanup);

type Report = components["schemas"]["AgentMetricsOut"];
type Measured = components["schemas"]["MeasuredMetricOut"];
type Estimated = components["schemas"]["EstimatedMetricOut"];

const measured = (over: Partial<Measured> = {}): Measured => ({
  kind: "measured",
  key: "returned_wrong_data",
  label: "Devueltos al usuario por datos incorrectos",
  value: 5,
  unit: "count",
  description: "Es lo que Ariadna busca bajar.",
  ...over,
});

const estimated = (over: Partial<Estimated> = {}): Estimated => ({
  kind: "estimated",
  key: "time_saved",
  label: "Tiempo ahorrado (estimado)",
  value: 28,
  unit: "minutes",
  basis: "Por ticket, según el estudio de una organización.",
  disclaimer: "no son resultados medidos",
  ...over,
});

const report = (period: 7 | 30): Report => ({
  period,
  sample: true,
  measured: [measured({ value: period === 7 ? 5 : 21 }), measured({ key: "passed_to_it", label: "Pasados a TI", value: 8, description: "d" })],
  estimated: {
    label: "Estimaciones, no son resultados medidos",
    metrics: [
      estimated(),
      estimated({ key: "savings", label: "Ahorro estimado", value: 4200, unit: "mxn", basis: "60 tickets guiados × 28 min × $150/h" }),
    ],
  },
  trend: Array.from({ length: period }, (_, i) => ({ day: i + 1, adoption: 50 + i, corrected: 20 - (i % 5) })),
});

describe("MeasuredBlock and EstimatedBlock (S-AM-4)", () => {
  it("the estimated block carries the label and each estimate says it is not measured", () => {
    render(<EstimatedBlock block={report(7).estimated} />);
    expect(screen.getAllByText("Estimaciones, no son resultados medidos").length).toBeGreaterThan(0);
    const items = within(screen.getByRole("list", { name: "Estimaciones" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const item of items) expect(item.textContent).toContain("no son resultados medidos");
    expect(items[0]!.textContent).toContain("28 min");
    expect(items[1]!.textContent).toContain("$4,200 MXN");
  });

  it("the measured block shows plain figures and never the estimate wording", () => {
    render(<MeasuredBlock metrics={report(7).measured} />);
    expect(screen.getByRole("heading", { name: "Medido" })).toBeTruthy();
    const items = within(screen.getByRole("list", { name: "Medido" })).getAllByRole("listitem");
    expect(items[0]!.textContent).toContain("Devueltos al usuario por datos incorrectos");
    expect(items[0]!.textContent).toContain("5");
    expect(document.body.textContent).not.toContain("no son resultados medidos");
  });
});

describe("StatTile in the blocks (R4.1, R4.2)", () => {
  it("only estimates use the estimated variant, and they keep the disclaimer", () => {
    const { container } = render(
      <>
        <MeasuredBlock metrics={report(7).measured} />
        <EstimatedBlock block={report(7).estimated} />
      </>,
    );
    const measuredList = within(screen.getByRole("list", { name: "Medido" }));
    const estimatedList = within(screen.getByRole("list", { name: "Estimaciones" }));
    for (const item of measuredList.getAllByRole("listitem")) {
      expect(item.className).toContain("stat-tile");
      expect(item.className).not.toContain("stat-tile--estimated");
    }
    for (const item of estimatedList.getAllByRole("listitem")) {
      expect(item.className).toContain("stat-tile--estimated");
      expect(item.textContent).toContain("no son resultados medidos");
    }
    expect(container.querySelectorAll(".summary-card")).toHaveLength(0);
  });
});

describe("TrendChart and TrendTable (S-AM-5)", () => {
  it("the table repeats exactly the numbers the chart plots", () => {
    const trend = report(7).trend;
    render(
      <>
        <TrendChart trend={trend} />
        <TrendTable trend={trend} />
      </>,
    );
    const chart = screen.getByRole("img", { name: /Tendencia/ });
    const plotted = [...chart.querySelectorAll("title")].map((t) => t.textContent);
    expect(plotted).toHaveLength(14); // 7 days x (adoption + corrected)
    const table = screen.getByRole("table", { name: /Tendencia/ });
    const region = screen.getByRole("region", { name: "Tabla de la tendencia diaria" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(within(region).getByRole("table", { name: /Tendencia/ })).toBe(table);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(7);
    trend.forEach((point, index) => {
      const cells = within(rows[index]!).getAllByRole("cell").map((c) => c.textContent);
      expect(cells).toEqual([String(point.day), `${point.adoption} %`, `${point.corrected} %`]);
      expect(plotted).toContain(`Día ${point.day}: adopción ${point.adoption} %`);
      expect(plotted).toContain(`Día ${point.day}: con corrección ${point.corrected} %`);
    });
  });
});

describe("TrendChart readability (R4.3)", () => {
  const trend = report(7).trend;

  it("has an HTML legend naming both series", () => {
    render(<TrendChart trend={trend} />);
    const items = within(screen.getByRole("list", { name: "Leyenda" })).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["Adopción", "Con corrección"]);
  });

  it("styles series by CSS class, never by inline colour, and scales with its container", () => {
    const { container } = render(<TrendChart trend={trend} />);
    const svg = screen.getByRole("img", { name: /Tendencia/ });
    expect(svg.getAttribute("viewBox")).toBeTruthy();
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.querySelector("polyline.trend-line--adoption")).not.toBeNull();
    expect(svg.querySelector("polyline.trend-line--corrected")).not.toBeNull();
    expect(container.innerHTML).not.toContain("currentColor");
    expect(svg.querySelectorAll("circle.trend-marker--adoption")).toHaveLength(7);
    expect(svg.querySelectorAll("rect.trend-marker--corrected")).toHaveLength(7);
  });

  it("shows axis ticks (0/50/100 and first/middle/last day) and an end label per series", () => {
    const { container } = render(<TrendChart trend={trend} />);
    const y = [...container.querySelectorAll(".trend-ytick")].map((t) => t.textContent);
    expect(y).toEqual(["100 %", "50 %", "0 %"]);
    const x = [...container.querySelectorAll(".trend-xtick")].map((t) => t.textContent);
    expect(x).toEqual(["Día 1", "Día 4", "Día 7"]);
    const ends = [...container.querySelectorAll<HTMLElement>(".trend-end")];
    expect(ends.map((e) => e.textContent)).toEqual(["56 %", "19 %"]);
    for (const end of ends) expect(end.style.getPropertyValue("--trend-y")).toMatch(/^\d+(\.\d+)?%$/);
  });
});

describe("TrendTable layout (R4.4)", () => {
  it("uses its own table class and marks numeric columns for right alignment", () => {
    const { container } = render(<TrendTable trend={report(7).trend} />);
    const table = container.querySelector("table")!;
    expect(table.className).toBe("data-table");
    expect(table.className).not.toContain("queue-table");
    expect(table.querySelectorAll("th.num")).toHaveLength(2);
    expect(table.querySelectorAll("td.num")).toHaveLength(14);
  });
});

describe("empty and loading states (R4.6)", () => {
  it("shows the empty copy instead of an empty chart and table when there are no points", () => {
    const empty = { ...report(7), trend: [] };
    const { container } = render(
      <AgentMetricsContainer reports={{ 7: empty, 30: report(30) }} initialPeriod={7} />,
    );
    expect(screen.getByText("Todavía no hay datos de tendencia para este periodo.")).toBeTruthy();
    expect(container.querySelector(".empty-state")).not.toBeNull();
    expect(screen.queryByRole("img", { name: /Tendencia/ })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("list", { name: "Medido" })).toBeTruthy();
  });

  it("the loading route renders a busy empty state with the loading copy", async () => {
    const { default: Loading } = await import("../../app/supervisor/agente/loading");
    const { container } = render(<Loading />);
    expect(screen.getByText("Cargando el seguimiento del agente…")).toBeTruthy();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });
});

describe("PeriodSwitch (R4.5)", () => {
  it("is a segmented control of native radios in a named group", () => {
    const { container } = render(<PeriodSwitch period={7} onChange={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: "Periodo" });
    expect(group.className).toContain("segmented");
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).type)).toEqual(["radio", "radio"]);
    expect(new Set(radios.map((r) => (r as HTMLInputElement).name)).size).toBe(1);
    expect(container.querySelector(".chip")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Mostrando los últimos 7 días");
  });

  it("reports the chosen period and does not fetch", () => {
    const calls: number[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("PeriodSwitch must not fetch");
    }) as typeof fetch;
    try {
      render(<PeriodSwitch period={7} onChange={(p) => calls.push(p)} />);
      fireEvent.click(screen.getByRole("radio", { name: "30 días" }));
      expect(calls).toEqual([30]);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("AgentMetricsContainer (S1)", () => {
  const reports = { 7: report(7), 30: report(30) } as const;

  it("labels the whole screen as sample data and starts on the requested period", () => {
    render(<AgentMetricsContainer reports={reports} initialPeriod={7} />);
    expect(screen.getAllByText("Datos de ejemplo").length).toBeGreaterThan(0);
    expect(screen.getByRole("radio", { name: "7 días" })).toHaveProperty("checked", true);
    expect(within(screen.getByRole("table", { name: /Tendencia/ })).getAllByRole("row")).toHaveLength(8);
  });

  it("AM-8: switching the period updates figures, chart and table together and announces it", () => {
    render(<AgentMetricsContainer reports={reports} initialPeriod={7} />);
    fireEvent.click(screen.getByRole("radio", { name: "30 días" }));
    expect(screen.getByRole("status").textContent).toBe("Mostrando los últimos 30 días");
    expect(within(screen.getByRole("table", { name: /Tendencia/ })).getAllByRole("row")).toHaveLength(31);
    expect(screen.getByRole("img", { name: /Tendencia/ }).querySelectorAll("title")).toHaveLength(60);
    const measuredItems = within(screen.getByRole("list", { name: "Medido" })).getAllByRole("listitem");
    expect(measuredItems[0]!.textContent).toContain("21");
  });

  it("starts on 30 days when asked to", () => {
    render(<AgentMetricsContainer reports={reports} initialPeriod={30} />);
    expect(screen.getByRole("radio", { name: "30 días" })).toHaveProperty("checked", true);
  });

  it("uses the shared page header with the sample-data badge as its action", () => {
    const { container } = render(<AgentMetricsContainer reports={reports} initialPeriod={7} />);
    const header = container.querySelector("header.page-header")!;
    expect(container.querySelector(".page-head")).toBeNull();
    expect(header.querySelectorAll("h1")).toHaveLength(1);
    expect(header.querySelector(".page-header__actions .badge")).not.toBeNull();
  });
});
