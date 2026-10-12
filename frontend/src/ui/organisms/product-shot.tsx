import { COPY } from "@/lib/copy";
import type { StepState } from "@/lib/ticket-labels";
import { Icon } from "../atoms/icon";
import { Stepper, type StepperStep } from "../molecules/stepper";

export type ProductShotVariant = "conversation" | "confirmation";

const LABELS: Record<ProductShotVariant, string> = {
  conversation: "Ejemplo de la conversación con Ariadna: una persona cuenta su problema y Ariadna le hace una pregunta",
  confirmation: "Ejemplo de la tarjeta de confirmación: a dónde iría la solicitud y qué falta antes de enviarla",
};

const STEP_LABELS = ["Qué pasa", "Detalles", "Adjuntos", "Revisión", "Enviado"] as const;
const CURRENT_STEP = 1;

const SHOT_STEPS: StepperStep[] = STEP_LABELS.map((label, index) => {
  const state: StepState = index < CURRENT_STEP ? "done" : index === CURRENT_STEP ? "current" : "upcoming";
  return { label, state, word: COPY.stepWords[state] };
});

function Conversation() {
  return (
    <div className="shot-body">
      <div className="msg msg--user">
        <span className="msg-who">Tú</span>
        <span className="msg-text">Mi computadora no abre el sistema de nóminas</span>
      </div>
      <div className="msg">
        <span className="msg-who">
          <Icon name="sparkles" size="sm" />
          Ariadna
        </span>
        <span className="msg-text">¿Desde cuándo te pasa?</span>
        <span className="shot-chips">
          <span className="shot-chip">Desde hoy</span>
          <span className="shot-chip">Desde esta semana</span>
        </span>
      </div>
      <Stepper steps={SHOT_STEPS} variant="full" label="Avance de la solicitud, paso 2 de 5" />
    </div>
  );
}

function Confirmation() {
  return (
    <div className="shot-body">
      <div className="shot-card">
        <div className="shot-row">
          <span className="t-meta">Lo enviaríamos a</span>
          <span className="shot-strong">
            <Icon name="users" size="sm" />
            Soporte a equipos
          </span>
          <span className="t-meta">Centro Administrativo Regional Sur</span>
        </div>
        <div className="shot-row">
          <span className="t-meta">Te falta</span>
          <span className="shot-strong">
            <Icon name="circle-alert" size="sm" />
            Número de equipo
          </span>
        </div>
        <div className="shot-row">
          <span className="pill tone-info">
            <Icon name="signal-medium" size="sm" />
            Prioridad estimada: Media
          </span>
        </div>
        <p className="t-meta shot-note">
          <Icon name="info" size="sm" />
          Todavía no se ha enviado nada
        </p>
        <div className="shot-actions">
          <span className="shot-btn shot-btn--outline">Seguir después</span>
          <span className="shot-btn shot-btn--accent">Revisar y enviar</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Static, non-interactive rendering of the real product UI, used as landing imagery. Announced as one
 * image; the inner markup is aria-hidden and inert so nothing in it can take focus.
 */
export function ProductShot({ variant }: { variant: ProductShotVariant }) {
  return (
    <figure className="shot" role="img" aria-label={LABELS[variant]}>
      <div className="shot-frame" aria-hidden="true" inert>
        {variant === "conversation" ? <Conversation /> : <Confirmation />}
      </div>
      <figcaption className="t-meta shot-caption">Datos de ejemplo</figcaption>
    </figure>
  );
}
