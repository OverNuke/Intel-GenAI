import type { CSSProperties } from "react";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";

type Point = components["schemas"]["TrendPointOut"];

const WIDTH = 640;
const HEIGHT = 220;
const Y_TICKS = [100, 50, 0];
/** Two end labels closer than this (in % of the plot height) are pushed apart so they stay legible. */
const MIN_LABEL_GAP = 10;

const clamp = (value: number) => Math.min(Math.max(value, 0), 100);

function scale(trend: Point[], pick: (p: Point) => number): { x: number; y: number; value: number }[] {
  const last = Math.max(trend.length - 1, 1);
  return trend.map((point, index) => {
    const value = pick(point);
    return {
      x: (WIDTH * index) / last,
      y: HEIGHT - (HEIGHT * clamp(value)) / 100,
      value,
    };
  });
}

/** Vertical position of an end label as a percentage from the top of the plot. */
function endPositions(a: number, b: number): [number, number] {
  const top = [100 - clamp(a), 100 - clamp(b)] as [number, number];
  if (Math.abs(top[0] - top[1]) >= MIN_LABEL_GAP) return top;
  const shift = (MIN_LABEL_GAP - Math.abs(top[0] - top[1])) / 2;
  return top[0] <= top[1] ? [top[0] - shift, top[1] + shift] : [top[0] + shift, top[1] - shift];
}

const yStyle = (percent: number): CSSProperties => ({ "--trend-y": `${percent}%` }) as CSSProperties;

/**
 * Hand-written SVG scaled by CSS. Text (legend, ticks, end labels) is HTML so it keeps its size
 * at any width. Lines differ by dash pattern and marker shape, so colour is never the only cue.
 */
export function TrendChart({ trend }: { trend: Point[] }) {
  const adoption = scale(trend, (p) => p.adoption);
  const corrected = scale(trend, (p) => p.corrected);
  const line = (points: { x: number; y: number }[]) => points.map((p) => `${p.x},${p.y}`).join(" ");
  const first = trend[0];
  const middle = trend[Math.floor((trend.length - 1) / 2)];
  const last = trend[trend.length - 1];
  const lastAdoption = adoption[adoption.length - 1];
  const lastCorrected = corrected[corrected.length - 1];
  const [adoptionY, correctedY] = endPositions(lastAdoption?.value ?? 0, lastCorrected?.value ?? 0);

  return (
    <div className="trend">
      <div className="trend-head">
        <ul aria-label={COPY.metrics.legend} className="trend-legend">
          <li className="trend-legend-item">
            <span className="trend-key trend-key--adoption" aria-hidden="true" />
            {COPY.metrics.adoption}
          </li>
          <li className="trend-legend-item">
            <span className="trend-key trend-key--corrected" aria-hidden="true" />
            {COPY.metrics.corrected}
          </li>
        </ul>
        <span className="t-meta" aria-hidden="true">
          {COPY.metrics.axisPercent}
        </span>
      </div>
      <div className="trend-plot">
        <div className="trend-yaxis" aria-hidden="true">
          {Y_TICKS.map((tick) => (
            <span key={tick} className="trend-ytick" style={yStyle(100 - tick)}>
              {`${tick} %`}
            </span>
          ))}
        </div>
        <svg
          role="img"
          aria-label={COPY.metrics.trendAria}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="trend-chart"
        >
          {Y_TICKS.map((tick) => {
            const y = HEIGHT - (HEIGHT * tick) / 100;
            return <line key={tick} className="trend-grid" x1={0} y1={y} x2={WIDTH} y2={y} />;
          })}
          <polyline className="trend-line trend-line--adoption" points={line(adoption)} />
          <polyline className="trend-line trend-line--corrected" points={line(corrected)} />
          {adoption.map((p, index) => (
            <circle key={`a-${trend[index]!.day}`} className="trend-marker--adoption" cx={p.x} cy={p.y} r="4">
              <title>{COPY.metrics.pointAdoption(trend[index]!.day, p.value)}</title>
            </circle>
          ))}
          {corrected.map((p, index) => (
            <rect
              key={`c-${trend[index]!.day}`}
              className="trend-marker--corrected"
              x={p.x - 4}
              y={p.y - 4}
              width="8"
              height="8"
            >
              <title>{COPY.metrics.pointCorrected(trend[index]!.day, p.value)}</title>
            </rect>
          ))}
        </svg>
        <div className="trend-ends" aria-hidden="true">
          {lastAdoption ? (
            <span className="trend-end trend-end--adoption" style={yStyle(adoptionY)}>
              {`${lastAdoption.value} %`}
            </span>
          ) : null}
          {lastCorrected ? (
            <span className="trend-end trend-end--corrected" style={yStyle(correctedY)}>
              {`${lastCorrected.value} %`}
            </span>
          ) : null}
        </div>
        <div className="trend-xaxis" aria-hidden="true">
          {[first, middle, last].map((point, index) =>
            point ? (
              <span key={index} className="trend-xtick">{`${COPY.metrics.axisDays} ${point.day}`}</span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
