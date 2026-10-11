import { COPY } from "@/lib/copy";
import { Icon } from "../atoms/icon";

/** U3 notice shown only while the ticket is Pendiente; carries IT's message when there is one. */
export function NeedDataNotice({ message }: { message: string | null }) {
  return (
    <div role="note" className="alert tone-warning">
      <Icon name="circle-alert" />
      <div className="stack">
        <p>
          <strong>{COPY.needData}</strong>
        </p>
        {message ? <p>{message}</p> : null}
        <p className="t-meta">{COPY.needDataHelp}</p>
      </div>
    </div>
  );
}
