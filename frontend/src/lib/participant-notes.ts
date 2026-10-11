import type { components } from "./api-types";
import { COPY } from "./copy";

type Out = Pick<components["schemas"]["ParticipantsOut"], "ambiguous" | "unknown" | "over_limit">;

const P = COPY.chat.proposal.participants;

/** The amber follow-ups of an "add participants" result: who still needs the person's attention. */
export function participantNotes(out: Out): string[] {
  return [
    ...out.ambiguous.map((a) => `${P.ambiguous} ${a.name}: ${a.candidates.join(", ")}.`),
    ...out.unknown.map((name) => `${P.unknown} ${name}.`),
    ...(out.over_limit.length > 0 ? [`${P.overLimit} ${out.over_limit.join(", ")}.`] : []),
  ];
}
