import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@duna/core";
import AdminChrome from "@/components/admin/AdminChrome";

// AUTHORITATIVE access gate for the admin panel (/admin/*). proxy.ts already
// bounces requests with no session cookie to /login; here we do the full
// server-side check — a valid Better Auth session AND a panel role (OWNER or
// MANAGER). STAFF and everyone else are sent back to /login. The access decision
// always happens on the server. Each sensitive /api/* handler re-checks session
// + role independently (defense in depth).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // La decisión de acceso se toma sobre la FILA, no sobre el payload de la
  // sesión. Es una consulta más por request y se paga a propósito: si el gate
  // dependiera de que `additionalFields` popule `activo` y algún día no lo
  // hiciera, fallaría ABIERTO —`undefined !== false`— y un usuario desactivado
  // entraría sin que nada lo delate. Un gate de acceso no puede tener un modo de
  // falla silencioso a favor del que entra.
  //
  // Además cierra el camino de volver a entrar: al desactivar se borran las
  // sesiones, pero nada impide iniciar sesión de nuevo — Better Auth no conoce
  // esta columna. Con el chequeo acá, esa sesión nueva rebota en el primer
  // request al panel.
  const usuario = await prisma.user.findUnique({
    where:  { id: (session.user as { id: string }).id },
    select: { role: true, activo: true },
  });

  if (!usuario || !usuario.activo) redirect("/login");
  if (usuario.role !== "OWNER" && usuario.role !== "MANAGER") redirect("/login");

  return <AdminChrome>{children}</AdminChrome>;
}
