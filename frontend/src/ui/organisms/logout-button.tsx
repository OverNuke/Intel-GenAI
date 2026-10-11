"use client";

import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { Icon } from "../atoms/icon";

/** Container: signs out, then always lands on A4 (a failed request must not trap the user). */
export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await apiPost("/api/auth/logout", undefined);
    router.replace("/sesion-cerrada");
    router.refresh();
  }

  return (
    <button type="button" role="menuitem" className="menu-item" onClick={() => void logout()}>
      <Icon name="log-out" size="sm" />
      Cerrar sesión
    </button>
  );
}
