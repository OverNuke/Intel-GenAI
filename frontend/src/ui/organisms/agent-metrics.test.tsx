// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { components } from "@/lib/api-types";
import { AgentMetricsContainer } from "./agent-metrics-container";
import { EstimatedBlock } from "./estimated-block";
import { MeasuredBlock } from "./measured-block";
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
