import type { ReactNode } from "react";

import { AdminThemeProvider } from "@/components/theme/AdminThemeProvider";
import { AdminScope } from "@/components/theme/AdminScope";
import { spaceGrotesk, instrumentSans, jetbrainsMono } from "./fonts";

// Layout del grupo admin (dashboard, login, aceptar-invitación). Monta el
// ThemeProvider del admin aquí para que TODO el producto interno — no solo
// /admin/* — soporte dark mode. El chrome del dashboard (Sidebar/TopBar con el
// toggle) sigue en app/(admin)/admin/layout.tsx.
//
// Tematización Duna (Duna Solutions): el paladar Duna está scopeado a `html.admin`
// en globals.css. `AdminScope` marca <html> al montar (y lo limpia al salir);
// el <script> inline lo aplica antes del primer paint en cargas completas para
// evitar un flash del paladar coffee del storefront. Las fuentes Duna viven en
// el wrapper `.admin-shell`.
export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AdminThemeProvider>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.add('admin')`,
        }}
      />
      <AdminScope />
      <div
        className={`${spaceGrotesk.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} admin-shell`}
      >
        {children}
      </div>
    </AdminThemeProvider>
  );
}
