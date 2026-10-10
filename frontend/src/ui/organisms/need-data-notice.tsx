import { COPY } from "@/lib/copy";

/** U3 notice shown only while the ticket is Pendiente; carries IT's message when there is one. */
export function NeedDataNotice({ message }: { message: string | null }) {
  return (
    <div role="note" className="callout need-data">
      <p>
        <strong aria-hidden="true">! </strong>
        <strong>{COPY.needData}</strong>
      </p>
      {message ? <p>{message}</p> : null}
      <p className="t-meta">{COPY.needDataHelp}</p>
    </div>
  );
}
