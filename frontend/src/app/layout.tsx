import type { Viewport } from "next";
import type { ReactElement, ReactNode } from "react";
import "@/ui/fonts.css";
import "@/ui/tokens.css";
import "@/ui/components.css";

/** `viewportFit: "cover"` makes iOS report real `env(safe-area-inset-*)` for the mobile tab bar. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata = {
  title: "Ariadna",
  description: "Mesa de ayuda de TI",
};

/** Only the two weights used above the fold are preloaded. */
const PRELOADED_FONTS = ["/fonts/Figtree-400.woff2", "/fonts/Figtree-600.woff2"];

export default function RootLayout({ children }: { children: ReactNode }): ReactElement<{
  lang: string;
  "data-theme": string;
}> {
  return (
    <html lang="es-MX" data-theme="grayscale">
      <head>
        {PRELOADED_FONTS.map((href) => (
          <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
