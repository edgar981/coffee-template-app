import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@duna/core";

// ─── EL GATE DE ACCESO AUTORITATIVO DEL PANEL — compartido por `/admin/*` Y `/editor/*` ───────────
//
// Extraído de `app/(admin)/admin/layout.tsx` (§ EDITOR-TIENDA-DISPOSITIVOS-1): hasta este slice era
// la ÚNICA fuente de esta decisión. El editor de pantalla completa (`/editor/tienda`) vive fuera del
// árbol de `AdminChrome` —es su propia ruta, sin sidebar ni topbar— pero tiene que exigir EXACTAMENTE
// el mismo acceso que el resto del panel: sesión Better Auth válida Y rol OWNER/MANAGER, verificado
// contra la fila de `User`. Dos layouts aplicando el MISMO gate necesitaban UNA sola definición, no
// una copiada — el modo de falla de siempre (`razonDelServidor`/`cruzoMinimo`, CLAUDE.md): si un día
// el gate cambiara de criterio en un solo lugar, el otro quedaría con la puerta vieja.
//
// `proxy.ts` ya bota con sólo la COOKIE de sesión (barato, sin consultar la base) a `/admin(.*)` y
// `/editor(.*)` antes de llegar acá; ESTE gate es el que de verdad decide, re-consultando la fila de
// `User` en cada carga — el payload de la sesión NUNCA es suficiente (ver `decidirAccesoAdmin`).

export interface UsuarioAccesoAdmin {
  role: string;
  activo: boolean;
}

export interface DecisionAccesoAdmin {
  ok: boolean;
  /** Presente sólo cuando `ok` es `false` — el motivo que `/login?motivo=` necesita para no dejar
   *  que un acceso denegado se vea idéntico a un bug (§ `AdminLayout`, "EL REBOTE NO ES SILENCIOSO"). */
  motivo?: "inactivo" | "sin_acceso";
}

/**
 * LA DECISIÓN PURA — testeada en capa 1 sin tocar Prisma ni Better Auth. Dado lo que la fila de
 * `User` dice (o `null`, si no existe), decide si entra o rebota, y con qué motivo.
 *
 * `usuario === null` cae en el mismo motivo que `activo === false` ("inactivo"): las dos son la
 * misma respuesta para quien mira el login — "tu cuenta no tiene acceso ahora mismo" — y una fila
 * ausente (un usuario borrado con sesión todavía viva) es, para este gate, indistinguible de una
 * desactivada.
 */
export function decidirAccesoAdmin(usuario: UsuarioAccesoAdmin | null): DecisionAccesoAdmin {
  if (!usuario || !usuario.activo) return { ok: false, motivo: "inactivo" };
  if (usuario.role !== "OWNER" && usuario.role !== "MANAGER") return { ok: false, motivo: "sin_acceso" };
  return { ok: true };
}

export interface SesionAdmin {
  user: { id: string; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * EXIGE una sesión Better Auth válida con rol OWNER/MANAGER, o REDIRIGE a `/login` (nunca retorna en
 * ese caso — `redirect()` lanza). Es el mismo chequeo, palabra por palabra, que ya corría dentro de
 * `app/(admin)/admin/layout.tsx`: sesión vía `auth.api.getSession`, la decisión sobre la FILA de
 * `User` (nunca sobre el payload de la sesión — un `additionalFields` que algún día no populara
 * `activo` fallaría ABIERTO si confiáramos en la sesión), y el motivo viajando en el query de
 * `/login` para que el rebote no sea silencioso.
 */
export async function requerirSesionAdmin(): Promise<SesionAdmin> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) redirect("/login");

  const usuario = await prisma.user.findUnique({
    where: { id: (session.user as { id: string }).id },
    select: { role: true, activo: true },
  });

  const decision = decidirAccesoAdmin(usuario);
  if (!decision.ok) redirect(`/login?motivo=${decision.motivo}`);

  return session as SesionAdmin;
}
