import type { IconName } from "@/ui/atoms/icon";

/** Catalog service key -> sprite icon. Keys mirror backend/app/modules/catalog/domain/services.py. */
export const SERVICE_ICONS: Record<string, IconName> = {
  access: "key-round",
  printing: "printer",
  email: "mail",
  network: "wifi",
  hardware: "laptop",
  software: "app-window",
};

const FALLBACK: IconName = "circle-ellipsis";

export function serviceIcon(key: string | undefined): IconName {
  if (key === undefined) return FALLBACK;
  return Object.hasOwn(SERVICE_ICONS, key) ? SERVICE_ICONS[key]! : FALLBACK;
}
