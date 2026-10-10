import type { components } from "@/lib/api-types";

type Receipt = components["schemas"]["ReceiptOut"];

/** "Constancia de Ariadna": read-only record of what she understood and checked (as submitted). */
export function AriadnaReceipt({ receipt }: { receipt: Receipt }) {
  return (
    <section aria-labelledby="receipt-title" className="card stack">
      <h2 id="receipt-title">Constancia de Ariadna</h2>
      <p>{receipt.understood}</p>
      <p className="t-meta">
        Destino sugerido: <strong>{receipt.target_group}</strong>
      </p>
      {receipt.reviewed.length > 0 ? (
        <div>
          <h3 className="t-label">Validaciones realizadas</h3>
          <ul aria-label="Validaciones realizadas" className="plain-list">
            {receipt.reviewed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {receipt.permissions_notice ? <p role="note">{receipt.permissions_notice}</p> : null}
      {receipt.missing_data.length > 0 ? (
        <div>
          <h3 className="t-label">Datos que faltaban</h3>
          <ul aria-label="Datos que faltaban" className="plain-list">
            {receipt.missing_data.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {receipt.not_done.length > 0 ? (
        <div>
          <h3 className="t-label">Dónde participó una persona</h3>
          <ul aria-label="Dónde participó una persona" className="plain-list">
            {receipt.not_done.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
