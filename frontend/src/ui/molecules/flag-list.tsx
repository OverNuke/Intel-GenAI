import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { Icon } from "../atoms/icon";

type Flag = components["schemas"]["Flag"];

/**
 * Red (blocking) and amber (recommended) items. Colour is never the only signal: each item has an
 * icon and a text prefix. There is no orange token, so "recommended" uses the amber warning tone.
 */
export function FlagList({ blocking, warnings }: { blocking: { field: string; label: string }[]; warnings: Flag[] }) {
  if (blocking.length === 0 && warnings.length === 0) return null;
  return (
    <ul aria-label={COPY.chat.flagsLabel} className="plain-list stack">
      {blocking.map((item) => (
        <li key={`b-${item.field}`} className="alert tone-error">
          <Icon name="circle-alert" />
          <p>
            <strong>{COPY.chat.blockingPrefix}:</strong> {item.label}
          </p>
        </li>
      ))}
      {warnings.map((flag, index) => (
        <li key={`w-${flag.field}-${index}`} className="alert tone-warning">
          <Icon name="triangle-alert" />
          <p>
            <strong>{COPY.chat.warningPrefix}:</strong> {flag.message}
          </p>
        </li>
      ))}
    </ul>
  );
}
