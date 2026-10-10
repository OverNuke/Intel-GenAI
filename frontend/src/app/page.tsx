import Link from "next/link";
import { PrototypeBanner } from "@/ui/atoms/prototype-banner";
import { ThemeSwitcher } from "@/ui/theme-switcher";

const BLOCKERS = [
  "Se clasifica mal o llega al área equivocada",
  "Faltan datos o hay errores en los documentos",
  "La solicitud está incompleta en el sistema",
  "No se tienen los permisos necesarios",
];

const STEPS = [
  ["Qué pasa", "Cuéntanos qué pasa con tus palabras"],
  ["Detalles", "Responde dos preguntas sencillas"],
  ["Adjuntos", "Agrega una captura si la tienes"],
  ["Revisión", "Revisa todo antes de enviar"],
  ["Enviado", "Queda registrado con su constancia"],
] as const;

const CARES = [
  "Lenguaje claro y un paso a la vez",
  "Solo pide los datos necesarios",
  "No decide por ti ni otorga permisos",
  "Deja constancia de lo que revisó",
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
        <div>
          <p className="wordmark">Ariadna</p>
          <p className="t-meta">Tu guía para solicitudes de TI</p>
        </div>
        <nav aria-label="Principal">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#que-cuida">Qué cuida</a>
          <Link href="/entrar">Iniciar sesión</Link>
        </nav>
      </header>
      <main className="landing">
        <section aria-labelledby="hero-title">
          <h1 id="hero-title">Te acompañamos a preparar tu solicitud de TI</h1>
          <p>
            Ariadna te hace preguntas breves, revisa que no falte nada y te dice a dónde va tu solicitud, antes de
            enviarla.
          </p>
          <p>
            <Link className="btn btn-primary" href="/entrar">
              Iniciar sesión
            </Link>{" "}
            <a className="btn btn-secondary" href="#como-funciona">
              Ver cómo funciona
            </a>
          </p>
        </section>

        <section aria-labelledby="frena-title">
          <h2 id="frena-title">Lo que suele frenar una solicitud</h2>
          <ul>
            {BLOCKERS.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <p>Ariadna no reemplaza las firmas ni arregla fallas del sistema.</p>
        </section>

        <section id="como-funciona" aria-labelledby="como-title">
          <h2 id="como-title">Cómo funciona</h2>
          <ol aria-label="Cómo funciona, en cinco pasos">
            {STEPS.map(([label, text]) => (
              <li key={label}>
                <strong>{label}:</strong> {text}
              </li>
            ))}
          </ol>
        </section>

        <section id="que-cuida" aria-labelledby="cuida-title">
          <h2 id="cuida-title">Qué cuida</h2>
          <ul>
            {CARES.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <p className="callout">Antes de enviar, siempre confirmas tú. Si hay dudas, una persona de TI continúa contigo.</p>
        </section>

        <section aria-labelledby="obs-title">
          <h2 id="obs-title">Lo que observamos</h2>
          <p id="obs-note" className="t-meta">
            Estimaciones de un estudio en una sola organización; no son resultados medidos.
          </p>
          <ul aria-labelledby="obs-title" aria-describedby="obs-note">
            {ESTIMATES.map(([value, label]) => (
              <li key={value}>
                <strong>{value}</strong> {label}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="prueba-title">
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
      </footer>
    </>
  );
}
