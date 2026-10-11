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

  it("provides the strings of the ticket detail and chat refinements", () => {
    expect(COPY.detail.stagesLabel).toBe("Etapas del ticket");
    expect(COPY.detail.viewLabel).toBe("Vista del ticket");
    expect(COPY.detail.railLabel).toBe("Datos del ticket");
    expect(COPY.detail.attachments).toBe("Adjuntos");
    expect(COPY.detail.noAttachments).toBe("Ninguno");
    expect(COPY.detail.noDate).toBe("Sin fecha");
    expect(COPY.detail.tookBy).toBe("Lo tomó");
    expect(COPY.detail.needDataSince).toBe("Necesitamos un dato de tu parte desde");
    expect(COPY.chat.sendReply).toBe("Enviar respuesta a Ariadna");
    expect(COPY.chat.back).toBe("Volver");
    expect(COPY.request.notSentYet).toBe("Todavía no se ha enviado nada.");
    expect(COPY.request.bandSteps).toEqual(["Qué pasa", "Detalles", "Revisión", "Enviado"]);
    expect(COPY.request.bandLabel).toBe("Pasos de tu solicitud");
    expect(COPY.request.readOnly).toBe("Solo lectura");
    expect(COPY.request.impactHint).toBe("¿A quién afecta?");
    expect(COPY.request.urgencyHint).toBe("¿Qué tan urgente es?");
    expect(COPY.request.impactDesc.medium).toBe("Impacto medio");
    expect(COPY.request.urgencyDesc.high).toBe("Urgencia alta");
  });
});
