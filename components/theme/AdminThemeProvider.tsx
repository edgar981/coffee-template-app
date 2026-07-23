"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Tema del ADMIN (producto interno, futura app separada de Duna): soporta dark
// mode con el toggle de TopBar (light / dark / system). `enableSystem` sigue la
// preferencia del SO; el toggle persiste la elección del usuario. La clase
// `.dark` sobre <html> solo se aplica dentro del grupo admin — el storefront la
// fuerza a `light` por su cuenta. Ver política de tema por grupo en CLAUDE.md.
export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
