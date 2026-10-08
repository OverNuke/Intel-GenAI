"use client";

import { useEffect, useState } from "react";
import { apiGet, type ApiResult, type GetResponse } from "@/lib/api-client";

type Load = () => Promise<ApiResult<GetResponse<"/api/health">>>;

const defaultLoad: Load = () => apiGet("/api/health");

export function HealthStatus({ load = defaultLoad }: { load?: Load }) {
  const [state, setState] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    let active = true;
    load().then((result) => {
      if (active) setState(result.ok ? "ok" : "error");
    });
    return () => {
      active = false;
    };
  }, [load]);

  if (state === "checking") return <p role="status">Comprobando el servicio…</p>;
  if (state === "ok") return <p role="status">Servicio disponible</p>;
  return <p role="alert">No pudimos conectar con el servicio</p>;
}
