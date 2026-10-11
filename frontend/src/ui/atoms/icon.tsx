import { ICONS, type IconName } from "./icon-paths";

export type { IconName };

/**
 * Decorative icon from the mock sprite. Always `aria-hidden`: a control that holds only an icon
 * must carry its own accessible name (REQ-VF-1). Stroke/fill come from `.icon` in components.css.
 */
export function Icon({ name, size = "md" }: { name: IconName; size?: "md" | "sm" | "lg" }) {
  return (
    <svg
      className={size === "sm" ? "icon icon-16" : size === "lg" ? "icon icon-24" : "icon"}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
    >
      {ICONS[name]}
    </svg>
  );
}
