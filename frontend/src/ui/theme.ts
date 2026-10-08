export const THEMES = ["grayscale", "azul", "verde"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "grayscale";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Sets `data-theme` on `root` when `value` is valid; otherwise keeps the current theme. Returns the active theme. */
export function applyTheme(root: HTMLElement, value: unknown): Theme {
  if (isTheme(value)) root.dataset.theme = value;
  const current = root.dataset.theme;
  return isTheme(current) ? current : DEFAULT_THEME;
}
