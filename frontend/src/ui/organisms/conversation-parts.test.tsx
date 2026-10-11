// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api-types";
import { EMPTY_DRAFT, EMPTY_TOUCHED } from "@/lib/merge-draft";
import { Chat } from "./chat";
import { HandoffActions } from "./handoff-actions";
import { RequestDraftForm } from "./request-draft-form";
import { UnderstoodPanel } from "./understood-panel";

afterEach(cleanup);

type Turn = components["schemas"]["AssistantTurn"];
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
    key: "software",
    label: "Software",
    description: "Instalar o actualizar programas",
    examples: [],
    have_at_hand: [],
    handled_by: "Soporte de software",
    requires_manager_authorization: true,
  },
];

describe("Chat", () => {
  const messages = [
    { role: "assistant" as const, content: "Hola, Ana. Cuéntame qué está pasando." },
    { role: "user" as const, content: "La impresora no imprime" },
  ];

  it("announces new turns politely and labels each speaker", () => {
    render(<Chat messages={messages} busy={false} onSend={vi.fn()} />);
    const log = screen.getByRole("log");
    expect(log.getAttribute("aria-live")).toBe("polite");
    const items = within(log).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain("Ariadna");
    expect(items[1]!.textContent).toContain("Tú");
    expect(items[1]!.textContent).toContain("La impresora no imprime");
  });

  it("marks the assistant speaker with the sparkles icon and styles each side as a message", () => {
    render(<Chat messages={messages} busy={false} onSend={vi.fn()} />);
    const items = within(screen.getByRole("log")).getAllByRole("listitem");
    expect(items[0]!.querySelector('[data-icon="sparkles"]')).not.toBeNull();
    expect(items[1]!.querySelector('[data-icon="sparkles"]')).toBeNull();
    expect(items[0]!.classList.contains("msg")).toBe(true);
    expect(items[1]!.classList.contains("msg--user")).toBe(true);
  });

  it("is the .conversation shell and renders the footer slot after the composer", () => {
    const { container } = render(
      <Chat messages={messages} busy={false} onSend={vi.fn()} footer={<p data-testid="slot">pie</p>} />,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.classList.contains("conversation")).toBe(true);
    const composer = shell.querySelector(".composer") as HTMLElement;
    const slot = screen.getByTestId("slot");
    expect(shell.contains(slot)).toBe(true);
    expect(composer.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(composer.contains(slot)).toBe(false);
  });

  it("renders no footer wrapper content when no slot is given", () => {
    const { container } = render(<Chat messages={messages} busy={false} onSend={vi.fn()} />);
    expect(container.querySelector(".conversation-footer")).toBeNull();
  });

  it("shows the typing indicator as an assistant bubble inside the polite log", () => {
    render(<Chat messages={messages} busy={true} onSend={vi.fn()} />);
    const log = screen.getByRole("log");
    expect(log.getAttribute("aria-live")).toBe("polite");
    const typing = within(log).getByText("Ariadna está escribiendo…");
    const bubble = typing.closest("li") as HTMLElement;
    expect(bubble.classList.contains("msg")).toBe(true);
    expect(typing.classList.contains("msg-text")).toBe(true);
    expect(bubble.querySelector('[data-icon="sparkles"]')).not.toBeNull();
  });

  it("marks only the newest message as new (fade-in), not the greeting alone", () => {
    const { rerender } = render(<Chat messages={messages.slice(0, 1)} busy={false} onSend={vi.fn()} />);
    expect(document.querySelector(".msg.is-new")).toBeNull();
    rerender(<Chat messages={messages} busy={false} onSend={vi.fn()} />);
    const items = within(screen.getByRole("log")).getAllByRole("listitem");
    expect(items[0]!.classList.contains("is-new")).toBe(false);
    expect(items[1]!.classList.contains("is-new")).toBe(true);
  });

  it("uses a one-line composer with a named icon send button (no 'Responder' text button)", () => {
    render(<Chat messages={messages} busy={false} onSend={vi.fn()} />);
    const box = screen.getByRole("textbox", { name: "Tu respuesta para Ariadna" }) as HTMLTextAreaElement;
    expect(box.tagName).toBe("TEXTAREA");
    expect(box.rows).toBe(1);
    expect(box.getAttribute("placeholder")).toBe("Escribe tu respuesta");
    const send = screen.getByRole("button", { name: "Enviar respuesta a Ariadna" });
    expect(send.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Responder" })).toBeNull();
  });

  it("sends the trimmed text with the button and with Enter, then clears the box", () => {
    const onSend = vi.fn();
    render(<Chat messages={messages} busy={false} onSend={onSend} />);
    const box = screen.getByLabelText("Tu respuesta para Ariadna") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "  Desde ayer  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta a Ariadna" }));
    expect(onSend).toHaveBeenCalledWith("Desde ayer");
    expect(box.value).toBe("");

    fireEvent.change(box, { target: { value: "Otra cosa" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSend).toHaveBeenLastCalledWith("Otra cosa");
    expect(onSend).toHaveBeenCalledTimes(2);
  });

  it("Shift+Enter makes a new line instead of sending", () => {
    const onSend = vi.fn();
    render(<Chat messages={messages} busy={false} onSend={onSend} />);
    const box = screen.getByLabelText("Tu respuesta para Ariadna");
    fireEvent.change(box, { target: { value: "línea" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("ignores empty input and shows a busy state without accepting a second message", () => {
    const onSend = vi.fn();
    const { rerender } = render(<Chat messages={messages} busy={false} onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta a Ariadna" }));
    expect(onSend).not.toHaveBeenCalled();

    rerender(<Chat messages={messages} busy={true} onSend={onSend} />);
    expect(screen.getByText("Ariadna está escribiendo…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar respuesta a Ariadna" }).getAttribute("aria-busy")).toBe("true");
    const box = screen.getByLabelText("Tu respuesta para Ariadna");
    fireEvent.change(box, { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta a Ariadna" }));
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("RequestDraftForm (Tu solicitud)", () => {
  const draft = { service: "printing", summary: "Impresora sin imprimir", description: "", impact: null, urgency: null };

  it("shows the draft values, tags assistant-filled fields and flags what is missing", () => {
    render(<RequestDraftForm draft={draft} touched={EMPTY_TOUCHED} services={SERVICES} requesterName="Ana Ruiz" onEdit={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Tu solicitud" })).toBeTruthy();
    expect((screen.getByLabelText("Resumen") as HTMLInputElement).value).toBe("Impresora sin imprimir");
    expect((screen.getByLabelText("Servicio") as HTMLSelectElement).value).toBe("printing");
    expect(screen.getAllByText("Lo llenó el asistente")).toHaveLength(2);
    expect(screen.getAllByText("Por completar").length).toBeGreaterThan(0);
  });

  it("reports edits per field and does not tag a touched field as assistant-filled", () => {
    const onEdit = vi.fn();
    render(
      <RequestDraftForm
        draft={draft}
        touched={{ ...EMPTY_TOUCHED, summary: true }}
        services={SERVICES}
        requesterName="Ana Ruiz"
        onEdit={onEdit}
      />,
    );
    expect(screen.getAllByText("Lo llenó el asistente")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Resumen"), { target: { value: "Nuevo título" } });
    expect(onEdit).toHaveBeenCalledWith("summary", "Nuevo título");
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Texto" } });
    expect(onEdit).toHaveBeenCalledWith("description", "Texto");
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "software" } });
    expect(onEdit).toHaveBeenCalledWith("service", "software");
  });

  it("states that nothing was sent yet and shows the 4-step band", () => {
    render(<RequestDraftForm draft={EMPTY_DRAFT} touched={EMPTY_TOUCHED} services={SERVICES} requesterName="Ana Ruiz" onEdit={vi.fn()} />);
    expect(screen.getByText("Todavía no se ha enviado nada.")).toBeTruthy();
    const band = screen.getByRole("list", { name: "Pasos de tu solicitud" });
    const steps = within(band).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[0]!.textContent).toContain("Qué pasa");
    expect(steps[0]!.getAttribute("aria-current")).toBe("step");
    expect(steps[3]!.textContent).toContain("Enviado");
  });

  it("S-TS-D5: Solicitante is read-only and shows the session user", () => {
    render(<RequestDraftForm draft={draft} touched={EMPTY_TOUCHED} services={SERVICES} requesterName="Ana Ruiz" onEdit={vi.fn()} />);
    const field = screen.getByLabelText("Solicitante") as HTMLInputElement;
    expect(field.value).toBe("Ana Ruiz");
    expect(field.readOnly).toBe(true);
    expect(screen.getByText("Solo lectura")).toBeTruthy();
  });

  it("puts the assist and to-do tags in the field head, not below the control", () => {
    render(<RequestDraftForm draft={draft} touched={EMPTY_TOUCHED} services={SERVICES} requesterName="Ana Ruiz" onEdit={vi.fn()} />);
    for (const tag of screen.getAllByText("Lo llenó el asistente")) {
      expect(tag.closest(".field-head")).not.toBeNull();
      expect(tag.className).toContain("assist-tag");
    }
    const todo = document.querySelectorAll(".todo-tag");
    expect(todo.length).toBeGreaterThan(0);
    for (const tag of todo) expect(tag.closest(".field-head")).not.toBeNull();
    expect(screen.getByLabelText("Resumen").getAttribute("aria-describedby")).toBeTruthy();
  });

  it("renders impact and urgency as option tiles that wrap a hidden native radio with a hint", () => {
    render(<RequestDraftForm draft={{ ...draft, impact: "medium" }} touched={EMPTY_TOUCHED} services={SERVICES} requesterName="Ana Ruiz" onEdit={vi.fn()} />);
    const radio = screen.getByRole("radio", { name: "Afecta a varias personas" }) as HTMLInputElement;
    expect(radio.checked).toBe(true);
    expect(radio.closest("label")!.classList.contains("opt-tile")).toBe(true);
    expect(radio.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Impacto medio")).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Impacto" }).classList.contains("opt-group")).toBe(true);
  });

  it("S-TS-D4: arrow keys move the selection through the options and wrap around", () => {
    const onEdit = vi.fn();
    render(<RequestDraftForm draft={{ ...draft, urgency: "low" }} touched={EMPTY_TOUCHED} services={SERVICES} requesterName="Ana Ruiz" onEdit={onEdit} />);
    const low = screen.getByRole("radio", { name: "Puede esperar" });
    fireEvent.keyDown(low, { key: "ArrowRight" });
    expect(onEdit).toHaveBeenLastCalledWith("urgency", "medium");
    fireEvent.keyDown(low, { key: "ArrowUp" });
    expect(onEdit).toHaveBeenLastCalledWith("urgency", "high");
    const high = screen.getByRole("radio", { name: "No puedo trabajar" });
    fireEvent.keyDown(high, { key: "ArrowDown" });
    expect(onEdit).toHaveBeenLastCalledWith("urgency", "low");
  });

  it("gives the impact and urgency groups stable ids so the opener can focus the first missing field", () => {
    render(<RequestDraftForm draft={draft} touched={EMPTY_TOUCHED} services={SERVICES} requesterName="Ana Ruiz" onEdit={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: "Impacto" }).id).toBe("impact-group");
    expect(screen.getByRole("radiogroup", { name: "Urgencia" }).id).toBe("urgency-group");
    expect(screen.getByLabelText("Servicio").id).toBe("f-service");
    expect(screen.getByLabelText("Resumen").id).toBe("f-summary");
    expect(screen.getByLabelText("Descripción").id).toBe("f-desc");
  });

  it("offers impact and urgency as radio groups in the user's language", () => {
    const onEdit = vi.fn();
    render(<RequestDraftForm draft={EMPTY_DRAFT} touched={EMPTY_TOUCHED} services={SERVICES} requesterName="Ana Ruiz" onEdit={onEdit} />);
    const impact = screen.getByRole("radiogroup", { name: "Impacto" });
    fireEvent.click(within(impact).getByRole("radio", { name: "Afecta a varias personas" }));
    expect(onEdit).toHaveBeenCalledWith("impact", "medium");
    const urgency = screen.getByRole("radiogroup", { name: "Urgencia" });
    fireEvent.click(within(urgency).getByRole("radio", { name: "No puedo trabajar" }));
    expect(onEdit).toHaveBeenCalledWith("urgency", "high");
  });
});

describe("UnderstoodPanel", () => {
  const turn: Turn = {
    message: "¿A cuántas personas afecta?",
    understood: "La impresora del piso 2 no imprime.",
    reviewed: ["Destino sugerido: Soporte de impresión", "Adjuntos: ninguno (opcional)"],
    draft: { service: "printing", summary: "x", description: "y", impact: null, urgency: null },
    missing_data: ["Impacto", "Urgencia"],
    target_group: "Soporte de impresión",
    needs_authorization: true,
    permissions_notice: "Instalar programas necesita la autorización de tu jefe o encargado.",
    ready: false,
  };

  it("S-AC-12: shows what was understood, what was reviewed, what is missing and the notice", () => {
    render(<UnderstoodPanel turn={turn} />);
    expect(screen.getByRole("heading", { name: "Esto es lo que entendí" })).toBeTruthy();
    expect(screen.getByText("La impresora del piso 2 no imprime.")).toBeTruthy();
    expect(screen.getByText("Lo enviaríamos a «Soporte de impresión»")).toBeTruthy();
    expect(screen.getByText("Te falta: Impacto, Urgencia")).toBeTruthy();
    const reviewed = screen.getByRole("list", { name: "Lo que revisé" });
    expect(within(reviewed).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("note").textContent).toContain("autorización de tu jefe o encargado");
  });

  it("marks the reviewed list with the list-checks icon without changing the list name", () => {
    render(<UnderstoodPanel turn={turn} />);
    const heading = screen.getByRole("heading", { level: 3, name: "Lo que revisé" });
    expect(heading.querySelector('[data-icon="list-checks"]')).not.toBeNull();
    expect(screen.getByRole("list", { name: "Lo que revisé" })).toBeTruthy();
  });

  it("always states that Ariadna sends nothing", () => {
    render(<UnderstoodPanel turn={turn} />);
    expect(screen.getByText(/Yo no envío nada/)).toBeTruthy();
    cleanup();
    render(<UnderstoodPanel turn={null} />);
    expect(screen.getByText(/Yo no envío nada/)).toBeTruthy();
  });

  it("omits the optional blocks when there is nothing to say", () => {
    render(<UnderstoodPanel turn={{ ...turn, missing_data: [], permissions_notice: null, needs_authorization: false }} />);
    expect(screen.queryByText(/Te falta/)).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("HandoffActions", () => {
  it("both IT actions are always enabled, also while busy, and call the same handler", () => {
    const onHandoff = vi.fn();
    render(<HandoffActions onHandoff={onHandoff} />);
    const talk = screen.getByRole("button", { name: "Hablar con TI" });
    const pass = screen.getByRole("button", { name: "Pasar con TI" });
    expect((talk as HTMLButtonElement).disabled).toBe(false);
    expect((pass as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(talk);
    fireEvent.click(pass);
    expect(onHandoff).toHaveBeenCalledTimes(2);
  });

  it("explains the handoff when it is already active", () => {
    render(<HandoffActions onHandoff={vi.fn()} active />);
    expect(screen.getByText("Listo. Una persona de TI verá tu caso. No tienes que repetir nada.")).toBeTruthy();
  });
});
