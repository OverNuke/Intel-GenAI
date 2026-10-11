import Link from "next/link";
import { Icon, type IconName } from "@/ui/atoms/icon";
import { PrototypeBanner } from "@/ui/atoms/prototype-banner";
import { Stepper, type StepperStep } from "@/ui/molecules/stepper";
import { ProductShot } from "@/ui/organisms/product-shot";
import { ThemeSwitcher } from "@/ui/theme-switcher";

const BLOCKERS: ReadonlyArray<readonly [IconName, string]> = [
  ["signpost", "Se clasifica mal o llega al área equivocada"],
  ["file-text", "Faltan datos o hay errores en los documentos"],
  ["circle-dashed", "La solicitud está incompleta en el sistema"],
  ["key-round", "No se tienen los permisos necesarios"],
];

/** The landing only describes the steps: none is done or current, so no state word is shown. */
const STEPS: StepperStep[] = (
  [
    ["Qué pasa", "Cuéntanos qué pasa con tus palabras"],
    ["Detalles", "Responde dos preguntas sencillas"],
    ["Adjuntos", "Agrega una captura si la tienes"],
    ["Revisión", "Revisa todo antes de enviar"],
    ["Enviado", "Queda registrado con su constancia"],
  ] as const
).map(([label, note], index) => ({ label, note, num: index + 1, state: "upcoming", word: "" }));

const CARES: ReadonlyArray<readonly [IconName, string]> = [
  ["message-square-text", "Lenguaje claro y un paso a la vez"],
  ["list-checks", "Solo pide los datos necesarios"],
  ["shield-check", "No decide por ti ni otorga permisos"],
  ["file-check", "Deja constancia de lo que revisó"],
];

const ESTIMATES = [
  ["7 pasos", "en el proceso observado"],
  ["60 a 180 min", "tiempo conocido por solicitud"],
  ["25 a 35 min", "preparar y validar (estimado)"],
] as const;

export default function Home() {
  return (
    <>
      <header className="landing-header">
        <div className="landing-brand">
          <span className="logo-slot" aria-hidden="true">
            <Icon name="image" />
          </span>
          <div>
            <p className="wordmark">Ariadna</p>
            <p className="t-meta">Tu guía para solicitudes de TI</p>
          </div>
        </div>
        <nav aria-label="Principal">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#que-cuida">Qué cuida</a>
          <Link className="btn btn-secondary" href="/entrar">
            Iniciar sesión
          </Link>
        </nav>
      </header>
      <main className="landing">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-hero-copy">
            <h1 id="hero-title">Te acompañamos a preparar tu solicitud de TI</h1>
            <p>
              Ariadna te hace preguntas breves, revisa que no falte nada y te dice a dónde va tu solicitud, antes de
              enviarla.
            </p>
            <div className="landing-cta">
              <Link className="btn btn-primary" href="/entrar">
                Iniciar sesión
              </Link>
              <a className="btn btn-secondary" href="#como-funciona">
                Ver cómo funciona
              </a>
            </div>
          </div>
          <ProductShot variant="conversation" />
        </section>

        <section aria-labelledby="frena-title">
          <h2 id="frena-title">Lo que suele frenar una solicitud</h2>
          <ul className="landing-cards" aria-labelledby="frena-title">
            {BLOCKERS.map(([icon, text]) => (
              <li key={text} className="landing-card">
                <Icon name={icon} size="md" />
                {text}
              </li>
            ))}
          </ul>
          <p className="t-meta landing-note">Ariadna no reemplaza las firmas ni arregla fallas del sistema.</p>
        </section>

        <section id="como-funciona" aria-labelledby="como-title">
          <h2 id="como-title">Cómo funciona</h2>
          <div className="band landing-steps">
            <Stepper steps={STEPS} variant="full" label="Cómo funciona, en cinco pasos" />
          </div>
        </section>

        <section id="que-cuida" className="landing-split" aria-labelledby="cuida-title">
          <ProductShot variant="confirmation" />
          <div className="landing-split-main">
            <h2 id="cuida-title">Qué cuida</h2>
            <ul className="landing-cares" aria-labelledby="cuida-title">
              {CARES.map(([icon, text]) => (
                <li key={text} className="landing-card">
                  <Icon name={icon} size="md" />
                  {text}
                </li>
              ))}
            </ul>
            <p className="landing-inverted">
              <Icon name="user-check" />
              Antes de enviar, siempre confirmas tú. Si hay dudas, una persona de TI continúa contigo.
            </p>
          </div>
        </section>

        <section aria-labelledby="obs-title">
          <h2 id="obs-title">Lo que observamos</h2>
          <p id="obs-note" className="t-meta">
            Estimaciones de un estudio en una sola organización; no son resultados medidos.
          </p>
          <ul className="landing-metrics" aria-labelledby="obs-title" aria-describedby="obs-note">
            {ESTIMATES.map(([value, label]) => (
              <li key={value} className="landing-metric">
                <strong>{value}</strong>
                <span className="t-meta">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-close" aria-labelledby="prueba-title">
          <h2 id="prueba-title">Prueba el prototipo</h2>
          <Link className="btn btn-primary" href="/entrar">
            Iniciar sesión
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <p className="wordmark">Ariadna</p>
        <PrototypeBanner />
        <ThemeSwitcher />
        <p className="t-meta landing-legal">Ariadna no está afiliada a BMC Software. Remedy es marca de BMC Software.</p>
      </footer>
    </>
  );
}
