"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Tema del STOREFRONT (producto cliente): paleta de marca fija cream/espresso,
// light-only, sin toggle. `forcedTheme="light"` garantiza que ni la preferencia
// del SO ni un `.dark` persistido por el admin (mismo <html> del repo compartido)
// se apliquen: al montar una ruta del storefront, next-themes fuerza la clase
// `light` sobre <html>. Ver política de tema por grupo en CLAUDE.md.
export function StorefrontThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" forcedTheme="light">
      {children}
    </NextThemesProvider>
  );
}
