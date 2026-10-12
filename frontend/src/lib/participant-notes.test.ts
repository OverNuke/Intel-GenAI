import { describe, expect, it } from "vitest";
import { participantNotes } from "./participant-notes";

describe("participantNotes", () => {
  it("is empty when everyone was added", () => {
    expect(participantNotes({ ambiguous: [], unknown: [], over_limit: [] })).toEqual([]);
  });

  it("lists ambiguous, unknown and over-limit names as plain sentences", () => {
    expect(
      participantNotes({
        ambiguous: [{ name: "Marta", candidates: ["Marta Díaz", "Marta Ruiz"] }],
        unknown: ["Pepe"],
        over_limit: ["Lola"],
      }),
    ).toEqual([
      "Hay más de una persona llamada Marta: Marta Díaz, Marta Ruiz.",
      "No encontramos a Pepe.",
      "No pudimos agregar por el límite de personas: Lola.",
    ]);
  });
});
