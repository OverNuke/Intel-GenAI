"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { DEFAULT_THEME, THEMES, applyTheme, isTheme, type Theme } from "./theme";

const LABELS: Record<Theme, string> = {
  grayscale: "Grayscale",
  azul: "Azul",
  verde: "Verde",
};

/** Collapsible "Barra de prototipo" with a radiogroup "Tema" (roving tabindex, arrow keys). */
export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  // The panel is closed during SSR/hydration, so reading <html> lazily cannot cause a visible mismatch.
  const [theme, setTheme] = useState<Theme>(() => {
    const current = typeof document === "undefined" ? undefined : document.documentElement.dataset.theme;
    return isTheme(current) ? current : DEFAULT_THEME;
  });
  const radios = useRef<Partial<Record<Theme, HTMLButtonElement | null>>>({});

  function choose(next: Theme, focus = false) {
    setTheme(applyTheme(document.documentElement, next));
    if (focus) radios.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = THEMES.indexOf(theme);
    choose(THEMES[(index + step + THEMES.length) % THEMES.length]!, true);
  }

  return (
    <section aria-label="Barra de prototipo" className="proto-bar">
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        aria-controls="proto-panel"
        onClick={() => setOpen((v) => !v)}
      >
        Barra de prototipo
      </button>
      {open ? (
        <div id="proto-panel">
          <span id="theme-label">Tema</span>
          <div role="radiogroup" aria-labelledby="theme-label">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme === t}
                tabIndex={theme === t ? 0 : -1}
                ref={(node) => {
                  radios.current[t] = node;
                }}
                className="btn btn-secondary"
                onClick={() => choose(t)}
                onKeyDown={onKeyDown}
              >
                {LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
