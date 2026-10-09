import type { ReactElement, ReactNode } from "react";
import "@/ui/tokens.css";
import "@/ui/components.css";

export const metadata = {
  title: "Ariadna",
  description: "Mesa de ayuda de TI",
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement<{
  lang: string;
  "data-theme": string;
}> {
  return (
    <html lang="es-MX" data-theme="grayscale">
      <body>{children}</body>
    </html>
  );
}
