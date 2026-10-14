// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

import { ConversationContainer } from "./conversation-container";

type Service = components["schemas"]["ServiceOut"];

const SERVICES: Service[] = [
  {
    key: "printing",
    label: "Impresión",
    description: "Impresoras y escáneres",
    examples: [],
    have_at_hand: [],
    handled_by: "Soporte de impresión",
    requires_manager_authorization: false,
  },
  {
    key: "network",
    label: "Red e internet",
    description: "Wi-Fi, VPN y conexión",
    examples: [],
    have_at_hand: [],
    handled_by: "Soporte de redes",
    requires_manager_authorization: false,
  },
];

const turn = (over: Record<string, unknown> = {}) => ({
  kind: "turn",
  turn: {
    message: "¿A cuántas personas afecta?",
    understood: "La impresora no imprime.",
    reviewed: ["Destino sugerido: Soporte de impresión"],
    draft: { service: "printing", summary: "Impresora sin imprimir", description: "No imprime", impact: null, urgency: null },
    missing_data: ["Impacto"],
    target_group: "Soporte de impresión",
    needs_authorization: false,
    permissions_notice: null,
    ready: false,
    ...over,
  },
});

const readyTurn = () =>
  turn({
    message: "Revisé tu solicitud. Tú decides.",
    draft: { service: "printing", summary: "Impresora sin imprimir", description: "No imprime", impact: "medium", urgency: "low" },
    missing_data: [],
    ready: true,
  });

type Route = (url: string, init: RequestInit) => Promise<Response> | Response;

function fetcher(routes: Record<string, Route>) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const handler = routes[String(url)];
    if (!handler) throw new Error(`unexpected ${String(url)}`);
    return handler(String(url), init ?? {});
  });
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const bodyOf = (f: ReturnType<typeof fetcher>, call: number) =>
  JSON.parse((f.mock.calls[call]![1] as RequestInit).body as string);

const ana = { id: "ana", name: "Ana Ruiz", email: "ana.ruiz@ejemplo.mx", area: "Finanzas", role: "user" } as const;

function open(f: ReturnType<typeof fetcher>, extra: Record<string, unknown> = {}) {
  return render(
    <ConversationContainer
      user={ana}
      entry={{ kind: "new", ref: null }}
      services={SERVICES}
      ticketSummary={null}
      fetchImpl={f as unknown as typeof fetch}
      timeoutMs={55_000}
      newKey={() => "key-1"}
      {...extra}
    />,
  );
}

const say = (text: string) => {
  fireEvent.change(screen.getByLabelText("Tu respuesta para Ariadna"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta a Ariadna" }));
};

beforeEach(() => push.mockReset());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ConversationContainer (U6)", () => {
  it("shows the chat head: Volver link, title, context chip and the IT actions once", () => {
    open(fetcher({}));
    expect(screen.getByRole("link", { name: "Volver" }).getAttribute("href")).toBe("/inicio");
    expect(screen.getByRole("heading", { level: 1, name: "Conversación con Ariadna" })).toBeTruthy();
    expect(screen.getByText("Datos de ejemplo")).toBeTruthy();
    const head = document.querySelector(".page-header") as HTMLElement;
    expect(head).not.toBeNull();
    expect(document.querySelector(".chat-head")).toBeNull();
    expect(head.querySelector("h1")).not.toBeNull();
    expect(head.querySelector('a[aria-label="Volver"]')).not.toBeNull();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Hablar con TI" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Pasar con TI" })).toHaveLength(1);
    cleanup();
    open(fetcher({}), { entry: { kind: "ticket", ref: "INC0001056" }, ticketSummary: "Red lenta" });
    expect(screen.getByRole("link", { name: "Volver" }).getAttribute("href")).toBe("/tickets/INC0001056");
  });

  it("S-AC-S3: the IT actions live under the composer in the chat shell, never in the chat head", () => {
    open(fetcher({}));
    for (const name of ["Hablar con TI", "Pasar con TI"]) {
      const button = screen.getByRole("button", { name });
      expect(button.closest(".page-header")).toBeNull();
      const shell = button.closest(".conversation") as HTMLElement;
      expect(shell).not.toBeNull();
      const composer = shell.querySelector(".composer") as HTMLElement;
      expect(composer.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(document.querySelector(".chat-head-actions")).toBeNull();
  });

  it("S-AC-S1: the summary column is visible and the form stays mounted but hidden", () => {
    open(fetcher({}));
    expect(screen.getByRole("heading", { name: "Esto es lo que entendí" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revisar y enviar" })).toBeTruthy();
    const panel = screen.getByLabelText("Resumen").closest("#u6-form") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(screen.getByLabelText("Resumen").closest("#u6-summary")).toBeNull();
    expect(screen.getByRole("heading", { name: "Esto es lo que entendí" }).closest("#u6-summary")!.hasAttribute("hidden")).toBe(false);
    expect(screen.queryByRole("button", { name: "Volver al resumen" })).toBeNull();
  });

  it("S-AC-S2: 'Editar solicitud' opens the form in place and 'Volver al resumen' restores the summary", () => {
    open(fetcher({}));
    const toggle = screen.getByRole("button", { name: "Editar solicitud" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("u6-form");
    expect(toggle.querySelector('[data-icon="maximize-2"]')).not.toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.querySelector('[data-icon="minimize-2"]')).not.toBeNull();
    expect(document.getElementById("u6-form")!.hasAttribute("hidden")).toBe(false);
    expect(document.getElementById("u6-summary")!.hasAttribute("hidden")).toBe(true);
    expect(screen.getByRole("heading", { name: "Tu solicitud" })).toBeTruthy();
    // the footer actions are outside the toggled region and stay available
    expect(toggle.closest("#u6-summary, #u6-form")).toBeNull();
    expect(screen.getByRole("button", { name: "Revisar y enviar" }).closest("#u6-summary, #u6-form")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Volver al resumen" }));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("u6-form")!.hasAttribute("hidden")).toBe(true);
    expect(document.getElementById("u6-summary")!.hasAttribute("hidden")).toBe(false);
    expect(document.activeElement).toBe(toggle);
  });

  it("the same toggle also closes the form (disclosure) and keeps focus on itself", () => {
    open(fetcher({}));
    const toggle = screen.getByRole("button", { name: "Editar solicitud" });
    toggle.focus();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("u6-form")!.hasAttribute("hidden")).toBe(true);
    expect(document.activeElement).toBe(toggle);
  });

  it("the typed chat text survives opening and closing the form panel", () => {
    open(fetcher({}));
    const box = screen.getByLabelText("Tu respuesta para Ariadna") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "borrador a medias" } });
    fireEvent.click(screen.getByRole("button", { name: "Editar solicitud" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver al resumen" }));
    expect((screen.getByLabelText("Tu respuesta para Ariadna") as HTMLTextAreaElement).value).toBe("borrador a medias");
    expect(screen.getByLabelText("Tu respuesta para Ariadna")).toBe(box);
  });

  it("S-TS-S1: a blocked review names every missing field next to the button and describes it", () => {
    open(fetcher({}));
    const review = screen.getByRole("button", { name: "Revisar y enviar" }) as HTMLButtonElement;
    expect(review.disabled).toBe(true);
    const reason = screen.getByText("Para revisar y enviar falta: Servicio, Resumen, Descripción, Impacto, Urgencia");
    expect(review.getAttribute("aria-describedby")).toBe(reason.id);
    expect(reason.id).not.toBe("");
    expect(screen.queryByText(/Te falta/)).toBeNull();
    expect(screen.queryByText(/Completa Servicio/)).toBeNull();
  });

  it("S-TS-S2: 'Completar en el formulario' opens the panel and focuses the first missing field", async () => {
    open(fetcher({}));
    fireEvent.click(screen.getByRole("button", { name: "Completar en el formulario" }));
    expect(document.getElementById("u6-form")!.hasAttribute("hidden")).toBe(false);
    expect(document.activeElement).toBe(document.getElementById("f-service"));
    await act(async () => {});
  });

  it("S-TS-S2: with only impact and urgency missing the first radio of Impacto gets focus", async () => {
    const f = fetcher({ "/api/assistant/turn": () => json(turn()) });
    open(f);
    say("La impresora no imprime");
    await waitFor(() => expect(screen.getByText("Para revisar y enviar falta: Impacto, Urgencia")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Completar en el formulario" }));
    const group = document.getElementById("impact-group") as HTMLElement;
    expect(group.hasAttribute("hidden")).toBe(false);
    expect(document.activeElement).toBe(group.querySelector("input[type=radio]"));
    // already open: the opener still moves focus to the first missing field
    (document.activeElement as HTMLElement).blur();
    fireEvent.click(screen.getByRole("button", { name: "Completar en el formulario" }));
    expect(document.activeElement).toBe(group.querySelector("input[type=radio]"));
  });

  it("S-TS-S3: a complete draft shows no reason and no opener, and only the confirmation step submits", async () => {
    const f = fetcher({
      "/api/assistant/turn": () => json(readyTurn()),
      "/api/tickets": () => json({ id: "INC0001061" }, 201),
    });
    open(f);
    say("La impresora no imprime");
    await waitFor(() => expect((screen.getByRole("button", { name: "Revisar y enviar" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText(/Para revisar y enviar falta/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Completar en el formulario" })).toBeNull();
    expect(screen.getByRole("button", { name: "Revisar y enviar" }).getAttribute("aria-describedby")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Revisar y enviar" }));
    expect(screen.getByRole("button", { name: "Enviar solicitud" })).toBeTruthy();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("S-AC-S4: after a handoff the IT actions stay enabled and the draft survives", () => {
    open(fetcher({}));
    fireEvent.change(screen.getByLabelText("Resumen"), { target: { value: "VPN caída" } });
    fireEvent.click(screen.getByRole("button", { name: "Pasar con TI" }));
    expect((screen.getByRole("button", { name: "Pasar con TI" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Hablar con TI" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText("Resumen") as HTMLInputElement).value).toBe("VPN caída");
    // impact and urgency are optional once handed off, so the reason no longer lists them
    expect(screen.getByText("Para revisar y enviar falta: Servicio, Descripción")).toBeTruthy();
  });

  it("greets according to the entry and keeps both IT actions available from the start", () => {
    open(fetcher({}));
    expect(screen.getByText("Hola, Ana. Cuéntame qué está pasando y te ayudo a preparar tu solicitud.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hablar con TI" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pasar con TI" })).toBeTruthy();
    cleanup();
    open(fetcher({}), { entry: { kind: "service", ref: "network" } });
    expect(screen.getByText("Elegiste «Red e internet». ¿Qué está pasando?")).toBeTruthy();
    cleanup();
    open(fetcher({}), { entry: { kind: "ticket", ref: "INC0001056" }, ticketSummary: "Red lenta" });
    expect(screen.getByText("Veo el ticket INC0001056. ¿Qué necesitas saber o agregar?")).toBeTruthy();
  });

  it("posts the history, entry and draft; shows the turn and fills 'Tu solicitud'", async () => {
    const f = fetcher({ "/api/assistant/turn": () => json(turn()) });
    open(f, { entry: { kind: "service", ref: "printing" } });
    say("La impresora no imprime");
    await waitFor(() => expect(screen.getByText("¿A cuántas personas afecta?")).toBeTruthy());
    const body = bodyOf(f, 0);
    expect(body.entry).toEqual({ kind: "service", ref: "printing" });
    expect(body.history.at(-1)).toEqual({ role: "user", content: "La impresora no imprime" });
    expect((screen.getByLabelText("Resumen") as HTMLInputElement).value).toBe("Impresora sin imprimir");
    expect(screen.getByText("Te falta: Impacto")).toBeTruthy();
    expect(screen.getByText("La impresora no imprime.")).toBeTruthy();
  });

  it("S-AC-10: the edited summary travels in the next request and is not overwritten", async () => {
    const f = fetcher({ "/api/assistant/turn": () => json(turn()) });
    open(f);
    say("La impresora no imprime");
    await waitFor(() => expect(screen.getByText("¿A cuántas personas afecta?")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Resumen"), { target: { value: "Mi propio título" } });
    say("Afecta a varias personas");
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    expect(bodyOf(f, 1).draft.summary).toBe("Mi propio título");
    await waitFor(() => expect(screen.queryByText("Ariadna está escribiendo…")).toBeNull());
    expect((screen.getByLabelText("Resumen") as HTMLInputElement).value).toBe("Mi propio título");
  });

  it("S-AC-11: a handoff from the API keeps the draft editable and shows the IT notice", async () => {
    const f = fetcher({
      "/api/assistant/turn": () =>
        json({ kind: "handoff", reason: "rate_limited", draft: { service: null, summary: "", description: "", impact: null, urgency: null } }),
    });
    open(f);
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Mi texto" } });
    say("hola");
    await waitFor(() =>
      expect(screen.getByText("Listo. Una persona de TI verá tu caso. No tienes que repetir nada.")).toBeTruthy(),
    );
    expect((screen.getByLabelText("Descripción") as HTMLTextAreaElement).value).toBe("Mi texto");
    expect((screen.getByLabelText("Resumen") as HTMLInputElement).disabled).toBe(false);
  });

  it("a request that takes longer than the timeout becomes a handoff instead of blocking", async () => {
    const hang = (_: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const f = fetcher({ "/api/assistant/turn": hang });
    open(f, { timeoutMs: 20 });
    say("hola");
    await waitFor(() =>
      expect(screen.getByText("Listo. Una persona de TI verá tu caso. No tienes que repetir nada.")).toBeTruthy(),
    );
    expect(screen.queryByText("Ariadna está escribiendo…")).toBeNull();
  });

  it("a network failure also degrades to the IT handoff", async () => {
    const f = fetcher({
      "/api/assistant/turn": () => {
        throw new TypeError("network");
      },
    });
    open(f);
    say("hola");
    await waitFor(() => expect(screen.getByText(/Una persona de TI verá tu caso/)).toBeTruthy());
  });

  it("review → confirm → submit posts a confirmed draft with the receipt and an idempotency key", async () => {
    const f = fetcher({
      "/api/assistant/turn": () => json(readyTurn()),
      "/api/tickets": () => json({ id: "INC0001061" }, 201),
    });
    open(f);
    say("La impresora no imprime");
    await waitFor(() => expect((screen.getByRole("button", { name: "Revisar y enviar" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Revisar y enviar" }));
    expect(f).toHaveBeenCalledTimes(1); // reviewing alone sends nothing
    fireEvent.click(await screen.findByRole("button", { name: "Enviar solicitud" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/solicitud/enviada/INC0001061"));
    const body = bodyOf(f, 1);
    expect(body.confirmed).toBe(true);
    expect(body.idempotency_key).toBe("key-1");
    expect(body.draft).toMatchObject({ service: "printing", impact: "medium", urgency: "low" });
    expect(body.receipt.target_group).toBe("Soporte de impresión");
    expect(body).not.toHaveProperty("requester_id");
  });

  it("S-TS-8: a failed submit keeps the draft, shows an error and the retry reuses the key", async () => {
    let attempts = 0;
    const f = fetcher({
      "/api/assistant/turn": () => json(readyTurn()),
      "/api/tickets": () => {
        attempts += 1;
        return attempts === 1 ? json({}, 500) : json({ id: "INC0001061" }, 201);
      },
    });
    open(f);
    say("La impresora no imprime");
    await waitFor(() => expect((screen.getByRole("button", { name: "Revisar y enviar" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Revisar y enviar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Enviar solicitud" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No pudimos enviar tu solicitud"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("Impresora sin imprimir")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/solicitud/enviada/INC0001061"));
    expect(bodyOf(f, 1).idempotency_key).toBe(bodyOf(f, 2).idempotency_key);
  });

  it("S-U7-2: a failed submit shows no «Avisamos a TI…» line, does not navigate and keeps the draft", async () => {
    const f = fetcher({
      "/api/assistant/turn": () => json(readyTurn()),
      "/api/tickets": () => json({}, 500),
    });
    open(f);
    say("La impresora no imprime");
    await waitFor(() => expect((screen.getByRole("button", { name: "Revisar y enviar" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText(COPY.request.sentNotice)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Revisar y enviar" }));
    expect(screen.queryByText(COPY.request.sentNotice)).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Enviar solicitud" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No pudimos enviar tu solicitud"));
    expect(screen.queryByText(COPY.request.sentNotice)).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("Impresora sin imprimir")).toBeTruthy();
  });

  it("'Pasar con TI' goes to the confirmation of the captured draft and submits without a receipt", async () => {
    const f = fetcher({ "/api/tickets": () => json({ id: "INC0001061" }, 201) });
    open(f);
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "network" } });
    fireEvent.change(screen.getByLabelText("Resumen"), { target: { value: "VPN caída" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "No conecta desde casa" } });
    fireEvent.click(screen.getByRole("button", { name: "Pasar con TI" }));
    // REQ-AC-14: the person lands on the confirmation of the captured draft.
    expect(screen.getByRole("heading", { name: "Tu solicitud" })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Enviar solicitud" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/solicitud/enviada/INC0001061"));
    const body = bodyOf(f, 0);
    expect(body).not.toHaveProperty("receipt");
    expect(body.draft).toMatchObject({ service: "network", summary: "VPN caída" });
  });

  it("'Pasar con TI' with an incomplete draft keeps the person in the conversation", () => {
    open(fetcher({}));
    fireEvent.click(screen.getByRole("button", { name: "Pasar con TI" }));
    expect(screen.getByText("Listo. Una persona de TI verá tu caso. No tienes que repetir nada.")).toBeTruthy();
    expect(screen.getByLabelText("Resumen")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Revisar y enviar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("'Revisar y enviar' stays disabled until the draft can be reviewed", () => {
    open(fetcher({}));
    expect((screen.getByRole("button", { name: "Revisar y enviar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("back from the confirmation returns to the conversation with everything intact", async () => {
    const f = fetcher({ "/api/assistant/turn": () => json(readyTurn()) });
    open(f);
    say("La impresora no imprime");
    await waitFor(() => expect((screen.getByRole("button", { name: "Revisar y enviar" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Revisar y enviar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Atrás" }));
    expect(await screen.findByLabelText("Tu respuesta para Ariadna")).toBeTruthy();
    expect((screen.getByLabelText("Resumen") as HTMLInputElement).value).toBe("Impresora sin imprimir");
    await act(async () => {});
  });
});

// --- agent v2: one-line intake, flags and proposals -------------------------------------------

const HARDWARE: Service = {
  key: "hardware",
  label: "Equipo de cómputo",
  description: "PC, laptop y periféricos",
  examples: [],
  have_at_hand: ["Número de activo"],
  handled_by: "Soporte de equipo",
  requires_manager_authorization: false,
};

const oneLineTurn = (over: Record<string, unknown> = {}) =>
  turn({
    message: "Dime a cuántas personas afecta.",
    understood: "Tu PC tiene los cables pelados.",
    reviewed: ["Destino sugerido: Soporte de equipo"],
    draft: {
      service: "hardware",
      summary: "PC con cables pelados",
      description: "Tengo un problema técnico con mi PC, los cables están pelados.",
      impact: null,
      urgency: "high",
    },
    missing_data: ["Impacto"],
    flags: [
      { field: "impact", severity: "blocking", message: "Falta indicar a cuántas personas afecta." },
      { field: "asset_number", severity: "warning", message: "número de inventario (empieza con AT-)" },
    ],
    target_group: "Soporte de equipo",
    ...over,
  });

const withProposals = (proposals: unknown[], base = turn()) => ({
  ...base,
  turn: { ...base.turn, proposals },
});

const LEVEL_INDEX: Record<string, number> = { low: 0, medium: 1, high: 2 };
const radio = (group: string, value: string) =>
  document.querySelectorAll<HTMLInputElement>(`#${group}-group input[type=radio]`)[LEVEL_INDEX[value]!]!;

describe("ConversationContainer agent v2", () => {
  it("one sentence fills 'Tu solicitud' and shows red and amber flags for what is left", async () => {
    const f = fetcher({ "/api/assistant/turn": () => json(oneLineTurn()) });
    open(f, { services: [...SERVICES, HARDWARE] });
    say("Tengo un problema técnico con mi PC, los cables están pelados.");
    await waitFor(() => expect(screen.getByText("Tu PC tiene los cables pelados.")).toBeTruthy());
    expect((screen.getByLabelText("Resumen") as HTMLInputElement).value).toBe("PC con cables pelados");
    expect((screen.getByLabelText("Descripción") as HTMLTextAreaElement).value).toContain("cables están pelados");
    expect(radio("urgency", "high").checked).toBe(true);
    const list = screen.getByRole("list", { name: "Lo que falta y lo que conviene revisar" });
    const [red, amber] = within(list).getAllByRole("listitem");
    expect(red!.textContent).toContain("Falta: Impacto");
    expect(amber!.textContent).toContain("Conviene revisar:");
    expect(amber!.textContent).toContain("número de inventario");
    expect((screen.getByRole("button", { name: "Revisar y enviar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("filling the missing field clears the red item at once but keeps the amber one", async () => {
    const f = fetcher({ "/api/assistant/turn": () => json(oneLineTurn()) });
    open(f, { services: [...SERVICES, HARDWARE] });
    say("PC con cables pelados");
    await waitFor(() => expect(screen.getByText("Tu PC tiene los cables pelados.")).toBeTruthy());
    fireEvent.click(radio("impact", "low"));
    const list = screen.getByRole("list", { name: "Lo que falta y lo que conviene revisar" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(list.textContent).not.toContain("Falta:");
    expect(list.textContent).toContain("Conviene revisar:");
    expect((screen.getByRole("button", { name: "Revisar y enviar" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a proposal never executes on arrival; add_participants posts only after Confirmar", async () => {
    const f = fetcher({
      "/api/assistant/turn": () =>
        json(
          withProposals([{ kind: "add_participants", names: ["Luis Herrera", "Pepe", "Marta"], ticket_ref: "INC0001056" }]),
        ),
      "/api/tickets/INC0001056/participants": () =>
        json({
          ticket: {},
          added: ["Luis Herrera"],
          ambiguous: [{ name: "Marta", candidates: ["Marta Díaz", "Marta Ruiz"] }],
          unknown: ["Pepe"],
          over_limit: [],
        }),
    });
    open(f, { entry: { kind: "ticket", ref: "INC0001056" }, ticketSummary: "Red lenta" });
    say("agrega a Luis, Pepe y Marta");
    await screen.findByRole("button", { name: "Confirmar" });
    expect(f).toHaveBeenCalledTimes(1); // only the turn
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    expect(bodyOf(f, 1)).toEqual({ names: ["Luis Herrera", "Pepe", "Marta"], confirmed: true });
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Luis Herrera");
    const notes = within(screen.getByRole("list", { name: "Para revisar" })).getAllByRole("listitem");
    expect(notes.map((n) => n.textContent)).toEqual([
      "Hay más de una persona llamada Marta: Marta Díaz, Marta Ruiz.",
      "No encontramos a Pepe.",
    ]);
  });

  it("Ahora no dismisses a proposal without calling anything", async () => {
    const f = fetcher({
      "/api/assistant/turn": () => json(withProposals([{ kind: "close_ticket", ticket_ref: "INC0001056" }])),
    });
    open(f);
    say("cierra el ticket");
    await screen.findByRole("button", { name: "Ahora no" });
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("close_ticket shows the backend 409 message as-is and keeps the card for a retry", async () => {
    const f = fetcher({
      "/api/assistant/turn": () => json(withProposals([{ kind: "close_ticket", ticket_ref: "INC0001056" }])),
      "/api/tickets/INC0001056/close": () =>
        json({ reason: "not-resolved", message: "El ticket todavía no está resuelto." }, 409),
    });
    open(f);
    say("cierra el ticket");
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("El ticket todavía no está resuelto.");
    expect(bodyOf(f, 1)).toEqual({ confirmed: true });
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
  });

  it("update_ticket PATCHes only the proposed fields with confirmed: true", async () => {
    const f = fetcher({
      "/api/assistant/turn": () =>
        json(withProposals([{ kind: "update_ticket", ticket_ref: "INC0001056", summary: "Red caída", urgency: "high" }])),
      "/api/tickets/INC0001056": () => json({ id: "INC0001056" }),
    });
    open(f, { entry: { kind: "ticket", ref: "INC0001056" }, ticketSummary: "Red lenta" });
    say("cambia el título");
    expect((await screen.findByRole("list", { name: "Cambios propuestos" })).textContent).toContain("Red lenta → Red caída");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    expect((f.mock.calls[1]![1] as RequestInit).method).toBe("PATCH");
    expect(bodyOf(f, 1)).toEqual({ summary: "Red caída", urgency: "high", confirmed: true });
    expect((await screen.findByRole("status")).textContent).toContain("INC0001056");
  });

  it("create_ticket proposal reuses the submit flow with confirmed: true and an idempotency key", async () => {
    const f = fetcher({
      "/api/assistant/turn": () => json(withProposals([{ kind: "create_ticket" }], readyTurn())),
      "/api/tickets": () => json({ id: "INC0001061" }, 201),
    });
    open(f);
    say("La impresora no imprime");
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar y enviar" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/solicitud/enviada/INC0001061"));
    const body = bodyOf(f, 1);
    expect(body.confirmed).toBe(true);
    expect(body.idempotency_key).toBe("key-1");
    expect(body.draft).toMatchObject({ service: "printing", summary: "Impresora sin imprimir" });
  });

  it("create_ticket proposal stays disabled while the draft has blocking items", async () => {
    const f = fetcher({
      "/api/assistant/turn": () => json(withProposals([{ kind: "create_ticket" }])),
    });
    open(f);
    say("La impresora no imprime");
    const button = (await screen.findByRole("button", { name: "Confirmar y enviar" })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  const queuedTurn = () =>
    withProposals([{ kind: "add_participants", names: ["Luis Herrera"], ticket_ref: null }], readyTurn());

  it("participants proposed before sending are queued and added right after the ticket is sent", async () => {
    const f = fetcher({
      "/api/assistant/turn": () => json(queuedTurn()),
      "/api/tickets": () => json({ id: "INC0001061" }, 201),
      "/api/tickets/INC0001061/participants": () =>
        json({ ticket: {}, added: ["Luis Herrera"], ambiguous: [], unknown: [], over_limit: [] }),
    });
    open(f);
    say("agrega a Luis");
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    expect((await screen.findByRole("status")).textContent).toContain("cuando envíes tu solicitud");
    expect(f).toHaveBeenCalledTimes(1); // nothing sent yet
    fireEvent.click(screen.getByRole("button", { name: "Revisar y enviar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Enviar solicitud" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/solicitud/enviada/INC0001061"));
    expect(bodyOf(f, 2)).toEqual({ names: ["Luis Herrera"], confirmed: true });
  });

  it("if adding the queued people fails the ticket stays sent and an amber notice appears", async () => {
    const f = fetcher({
      "/api/assistant/turn": () => json(queuedTurn()),
      "/api/tickets": () => json({ id: "INC0001061" }, 201),
      "/api/tickets/INC0001061/participants": () => json({ detail: "boom" }, 500),
    });
    open(f);
    say("agrega a Luis");
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "Revisar y enviar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Enviar solicitud" }));
    const notice = await screen.findByText(/no pudimos agregar a las personas/);
    expect(notice.closest(".tone-warning")).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Ver el ticket" }).getAttribute("href")).toBe("/solicitud/enviada/INC0001061");
  });
});
