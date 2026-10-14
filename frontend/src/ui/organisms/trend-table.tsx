import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";

type Point = components["schemas"]["TrendPointOut"];

/** The same series as the chart, as a table (the chart is never the only way to read it). */
export function TrendTable({ trend }: { trend: Point[] }) {
  return (
    <div className="table-scroll" role="region" aria-label={COPY.metrics.trendTableRegion} tabIndex={0}>
      <table className="data-table">
        <caption>{COPY.metrics.trendTitle}</caption>
        <thead>
          <tr>
            <th scope="col">{COPY.metrics.day}</th>
            <th scope="col" className="num">{`${COPY.metrics.adoption} (%)`}</th>
            <th scope="col" className="num">{`${COPY.metrics.corrected} (%)`}</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((point) => (
            <tr key={point.day}>
              <td>{point.day}</td>
              <td className="num">{`${point.adoption} %`}</td>
              <td className="num">{`${point.corrected} %`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
