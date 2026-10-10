const NUMBER = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

export type MeasuredUnit = "count" | "percent";
export type EstimatedUnit = "minutes" | "score" | "mxn";

export function formatMeasured(value: number, unit: MeasuredUnit): string {
  return unit === "percent" ? `${NUMBER.format(value)} %` : NUMBER.format(value);
}

export function formatEstimated(value: number, unit: EstimatedUnit): string {
  if (unit === "minutes") return `${NUMBER.format(value)} min`;
  if (unit === "score") return `${NUMBER.format(value)} de 5`;
  return `$${NUMBER.format(Math.round(value))} MXN`;
}
