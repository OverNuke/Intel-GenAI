import { describe, expect, it } from "vitest";
import { COPY } from "./copy";

describe("COPY (verbatim es-MX strings extracted from the mock)", () => {
  it("keeps the known verbatim labels", () => {
    expect(COPY.newTicket).toBe("Nuevo ticket");
    expect(COPY.clearFilters).toBe("Limpiar filtros");
    expect(COPY.needData).toBe("Necesitamos un dato de tu parte");
    expect(COPY.tabs).toEqual({ open: "Abiertos", closed: "Cerrados", all: "Todos" });
    expect(COPY.myTickets).toBe("Mis tickets");
    expect(COPY.whatDoYouNeed).toBe("¿Qué necesitas?");
    expect(COPY.myTeam).toBe("Mi equipo");
  });

  it("keeps the plain-language ticket stage labels in lifecycle order", () => {
    expect(COPY.stages).toEqual({
      new: "Recibido",
      assigned: "Ya lo tiene un especialista",
      in_progress: "En revisión por TI",
      resolved: "Resuelto",
      closed: "Cerrado",
    });
  });

  it("keeps the user-language impact and urgency wording", () => {
    expect(COPY.impact).toEqual({
      low: "Solo me afecta a mí",
      medium: "Afecta a varias personas",
      high: "Afecta a toda mi área",
    });
    expect(COPY.urgency).toEqual({
      low: "Puede esperar",
      medium: "Puedo trabajar con dificultad",
      high: "No puedo trabajar",
    });
  });
});
