"use client";

import { useState } from "react";
import { DEFAULT_THEME, THEMES, applyTheme, type Theme } from "./theme";

const LABELS: Record<Theme, string> = {
  grayscale: "Grises",
  azul: "Azul",
  verde: "Verde",
};

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  return (
    <label>
      Tema{" "}
      <select
        value={theme}
        onChange={(event) => setTheme(applyTheme(document.documentElement, event.target.value))}
      >
        {THEMES.map((t) => (
          <option key={t} value={t}>
            {LABELS[t]}
          </option>
        ))}
      </select>
    </label>
  );
}
