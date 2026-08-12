"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Tema del ADMIN (producto interno, futura app separada de Duna): soporta dark
// mode con el toggle de TopBar (light / dark / system). `enableSystem` sigue la
// preferencia del SO; el toggle persiste la elección del usuario. La clase
// `.dark` sobre <html> solo se aplica dentro del grupo admin — el storefront la
// fuerza a `light` por su cuenta. Ver política de tema por grupo en CLAUDE.md.
//
// ── DOS ATRIBUTOS, no uno, y ninguno es redundante ───────────────────────────
//
// `.dark`       — de lo que dependen ~300 líneas de globals.css, el `dark:` de
//                 Tailwind (atado a la clase con `@custom-variant`) y todo el
//                 chrome shadcn del panel.
// `data-theme`  — el contrato de @duna/design-system, cuyo bloque oscuro es
//                 `[data-theme="dark"]`.
//
// Se escriben las DOS a propósito: el sistema de diseño no aprende la convención
// de nadie —es un paquete agnóstico, y hacerle conocer next-themes lo ataría a un
// consumidor— así que el que se adapta es el consumidor. next-themes lo soporta
// nativamente con un array, y lo sigue haciendo ANTES del primer paint, así que
// no aparece un flash de tema claro en el panel oscuro.
//
// Ojo si algún día se quita uno: quitar `class` apaga el chrome entero; quitar
// `data-theme` deja el design-system en claro DENTRO del panel en oscuro — y ese
// falla en silencio, porque la pantalla se ve, sólo que con la paleta que no es.
export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute={["class", "data-theme"]} defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
