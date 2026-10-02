import AdminChrome from "@/components/admin/AdminChrome";
import { getSiteSettings } from "@/lib/config/site-settings";
import { SiteSettingsProvider } from "@/components/admin/SiteSettingsProvider";
import { requerirSesionAdmin } from "@/lib/admin/acceso-admin";

// AUTHORITATIVE access gate for the admin panel (/admin/*). proxy.ts already
// bounces requests with no session cookie to /login; `requerirSesionAdmin()` does
// the full server-side check — a valid Better Auth session AND a panel role (OWNER
// or MANAGER). STAFF and everyone else are sent back to /login. The access decision
// always happens on the server. Each sensitive /api/* handler re-checks session
// + role independently (defense in depth).
//
// EL GATE EN SÍ VIVE EN `lib/admin/acceso-admin.ts` (§ EDITOR-TIENDA-DISPOSITIVOS-1): el editor de
// pantalla completa (`app/(admin)/editor/layout.tsx`) exige EXACTAMENTE el mismo acceso, sin montar
// `AdminChrome` — dos layouts necesitaban la MISMA decisión, no una copiada.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // La config del negocio (SiteSetting) es INDEPENDIENTE de la sesión, así que va en paralelo con el
  // gate completo (sesión + fila de usuario) en un Promise.all — más paralelo aún que antes: el gate
  // extraído resuelve sesión Y usuario en una sola cadena, y esa cadena entera corre junto a
  // `getSiteSettings()`, en vez de sólo la mitad (`getSession`) como antes de la extracción.
  const [, settings] = await Promise.all([
    requerirSesionAdmin(),
    getSiteSettings(),
  ]);

  return (
    <SiteSettingsProvider value={settings}>
      <AdminChrome>{children}</AdminChrome>
    </SiteSettingsProvider>
  );
}
