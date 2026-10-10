import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";

type Point = components["schemas"]["TrendPointOut"];

const WIDTH = 640;
const HEIGHT = 220;
const PAD = 24;

function scale(trend: Point[], pick: (p: Point) => number): { x: number; y: number; value: number }[] {
  const last = Math.max(trend.length - 1, 1);
  return trend.map((point, index) => {
    const value = pick(point);
    return {
      x: PAD + ((WIDTH - 2 * PAD) * index) / last,
      y: HEIGHT - PAD - ((HEIGHT - 2 * PAD) * Math.min(Math.max(value, 0), 100)) / 100,
      value,
    };
  });
}

/** Hand-written SVG. Lines differ by dash pattern and marker, so colour is never the only cue. */
export function TrendChart({ trend }: { trend: Point[] }) {
  const adoption = scale(trend, (p) => p.adoption);
  const corrected = scale(trend, (p) => p.corrected);
  const line = (points: { x: number; y: number }[]) => points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      role="img"
      aria-label={COPY.metrics.trendAria}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="trend-chart"
    >
      <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} stroke="currentColor" strokeWidth="1" />
      <polyline points={line(adoption)} fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points={line(corrected)} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
      {adoption.map((p, index) => (
        <circle key={`a-${trend[index]!.day}`} cx={p.x} cy={p.y} r="3" fill="currentColor">
          <title>{`${COPY.metrics.day} ${trend[index]!.day}: adopción ${p.value} %`}</title>
        </circle>
      ))}
      {corrected.map((p, index) => (
        <rect key={`c-${trend[index]!.day}`} x={p.x - 3} y={p.y - 3} width="6" height="6" fill="currentColor">
          <title>{`${COPY.metrics.day} ${trend[index]!.day}: con corrección ${p.value} %`}</title>
        </rect>
      ))}
    </svg>
  );
}
