import Link from "next/link";
import { Icon } from "@/ui/atoms/icon";
import { PageHeader } from "@/ui/molecules/page-header";
import { PrototypeBanner } from "@/ui/atoms/prototype-banner";

/** Public 404: static, no session or backend, so it also works with the API down. */
export function NotFoundScreen() {
  return (
    <div className="nf-page">
      <header className="nf-header">
        <Link className="wordmark nf-wordmark" href="/">
          Ariadna
        </Link>
        <Link href="/entrar">Entrar</Link>
      </header>
      <main className="nf-main" aria-labelledby="view-title">
        <PageHeader title="Página no encontrada" titleId="view-title" />
        <hr className="nf-divider" />
        <div className="nf-body">
          <p>Esta dirección no existe o cambió de lugar. Vuelve al inicio y retoma desde ahí.</p>
          <Link className="nf-exit" href="/">
            Volver al inicio <Icon name="arrow-right" size="sm" />
          </Link>
        </div>
      </main>
      <footer className="nf-footer">
        <PrototypeBanner />
      </footer>
    </div>
  );
}
