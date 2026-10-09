import Link from "next/link";
import { PrototypeBanner } from "@/ui/atoms/prototype-banner";
import { StateCard } from "@/ui/organisms/state-card";

export default function SesionCerradaPage() {
  return (
    <StateCard title="Cerraste sesión">
      <p>Para volver, inicia sesión de nuevo. Si usas una computadora compartida, cierra también el navegador.</p>
      <Link className="btn btn-primary" href="/entrar">
        Volver a entrar
      </Link>
      <PrototypeBanner />
    </StateCard>
  );
}
