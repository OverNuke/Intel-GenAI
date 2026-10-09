import { describe, expect, it } from "vitest";
import { deniedSentence, parseDenied, ROLE_HOME, sinAccesoHref } from "./access-labels";

describe("ROLE_HOME", () => {
  it("maps each role to its start section", () => {
    expect(ROLE_HOME).toEqual({ user: "/inicio", it: "/ti/seguimiento", supervisor: "/supervisor/agente" });
  });
});

describe("sinAccesoHref", () => {
  it("encodes section and required role keys", () => {
    expect(sinAccesoHref({ section: { key: "agent-tracking" }, required_role: { key: "supervisor" } })).toBe(
      "/sin-acceso?section=agent-tracking&required=supervisor",
    );
  });

  it("omits required when the policy has none (unknown section)", () => {
    expect(sinAccesoHref({ section: { key: "nope" }, required_role: null })).toBe("/sin-acceso?section=nope");
  });
});

describe("deniedSentence", () => {
  it("names section and role from known codes", () => {
    expect(deniedSentence("agent-tracking", "supervisor")).toBe("Seguimiento del agente es solo para Supervisor.");
    expect(deniedSentence("ticket-tracking", "it")).toBe("Seguimiento de tickets es solo para TI.");
  });

  it("falls back to generic copy for unknown codes", () => {
    expect(deniedSentence("whatever", "root")).toBe("No tienes acceso a esta sección.");
    expect(deniedSentence(undefined, undefined)).toBe("No tienes acceso a esta sección.");
    expect(deniedSentence("ticket-tracking", undefined)).toBe("No tienes acceso a esta sección.");
  });
});

describe("parseDenied", () => {
  it("accepts only known keys", () => {
    expect(parseDenied({ section: "registry", required: "it" })).toEqual({ section: "registry", required: "it" });
    expect(parseDenied({ section: "evil<script>", required: "it" })).toEqual({ required: "it" });
    expect(parseDenied({ section: ["registry"], required: "admin" })).toEqual({});
  });
});
