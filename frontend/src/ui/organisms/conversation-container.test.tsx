// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api-types";

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
      expect(button.closest(".chat-head")).toBeNull();
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
