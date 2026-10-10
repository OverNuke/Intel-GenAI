import { COPY } from "@/lib/copy";

/** Minimal placeholder for sections without a screen in this change (Registro, Cierre). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="stack">
      <h1 tabIndex={-1}>{title}</h1>
      <p>{COPY.nextStage}</p>
    </div>
  );
}
