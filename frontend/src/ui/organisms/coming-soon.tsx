import { COPY } from "@/lib/copy";
import { PageHeader } from "../molecules/page-header";

/** Minimal placeholder for sections without a screen in this change (Registro, Cierre). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="stack">
      <PageHeader title={title} />
      <p>{COPY.nextStage}</p>
    </div>
  );
}
