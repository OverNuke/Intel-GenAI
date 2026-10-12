import { ICONS, type IconName } from "./icon-paths";

export type { IconName };

/**
 * Decorative icon from the mock sprite. Always `aria-hidden`: a control that holds only an icon
 * must carry its own accessible name (REQ-VF-1). Stroke/fill come from `.icon` in components.css.
 * Sizes are 16 (`sm`), 20 (`md`) and 24 (`lg`) px only; an unknown name renders nothing.
 */
export function Icon({ name, size = "md" }: { name: IconName; size?: "md" | "sm" | "lg" }) {
  if (!(name in ICONS)) return null;
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
