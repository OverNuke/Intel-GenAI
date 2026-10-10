export type SummaryItem = { label: string; value: number };

export function SummaryCards({ items }: { items: SummaryItem[] }) {
  return (
    <ul aria-label="Resumen" className="summary-cards">
      {items.map((item) => (
        <li key={item.label} className="summary-card">
          <span className="summary-value">{item.value}</span>
          <span className="t-meta">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
