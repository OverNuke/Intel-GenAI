"use client";

import { useEffect } from "react";
import { Button } from "@/ui/atoms/button";
import { StateCard } from "@/ui/organisms/state-card";

/** Route error boundary (AS-D7): a plain-language state with retry, never a blank page. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StateCard title="No pudimos cargar esta página" icon="⚠">
      <p>Hubo un problema al conectar con el servicio. Inténtalo de nuevo en unos segundos.</p>
      <div className="actions">
        <Button onClick={() => retry()}>Reintentar</Button>
      </div>
    </StateCard>
  );
}
