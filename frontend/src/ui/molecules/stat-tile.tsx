import type { ReactNode } from "react";

export type StatTileProps = {
  label: string;
  /** Already formatted by the caller (measured and estimated formatting differ). */
  value: string;
  basis?: string;
  variant?: "measured" | "estimated";
  /** Slot for the caller's wording, e.g. the estimate disclaimer. This tile adds none. */
  children?: ReactNode;
};

/**
 * One figure with its label. Type-agnostic by design (ADR-0006): the measured/estimated
 * distinction is owned by MeasuredBlock and EstimatedBlock; this tile only styles the variant.
 * Renders a list item: use it inside a `ul`.
 */
export function StatTile({ label, value, basis, variant = "measured", children }: StatTileProps) {
  const className = variant === "estimated" ? "stat-tile stat-tile--estimated" : "stat-tile";
  return (
    <li className={className}>
      <span className="stat-tile__value">{value}</span>
      <span className="stat-tile__label">{label}</span>
      {basis ? <span className="t-meta">{basis}</span> : null}
      {children}
    </li>
  );
}
