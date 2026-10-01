import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import prisma, { type Role } from '@duna/core';
import { ENCABEZADO_MODO_EDITOR, VALOR_MODO_EDITOR } from '@/lib/admin/editor-iframe';

// EL GATE DEL MODO EDITOR del storefront (§ EDITOR-TIENDA-IFRAME-GATE-1, slice 1 del plan de
// `docs/editor-tienda/DISENO.md`; reescrito en `MODO-EDITOR-SOLO-EN-EL-IFRAME-1`, abajo).
//
// LA MARCA SOLA NO ALCANZA — nunca gatea el acceso por sí misma. Es sólo el FLAG de activación;
// quien decide es la MISMA sesión server-side que ya gatea el panel (`app/(admin)/admin/
// layout.tsx`): sesión válida + rol OWNER/MANAGER + `activo` en la FILA de `User`, jamás en el
// payload de la cookie de sesión. Replica ese gate, el MÁS ESTRICTO de los dos que conviven en el
// repo (el otro es `requireAdmin` de las rutas `/api/site-content/*`, que no chequea `activo`) —
// mismo motivo que ahí: si el gate dependiera de que `additionalFields.activo` poblara la sesión y
// algún día no lo hiciera, fallaría ABIERTO (`undefined !== false`).
//
// POR QUÉ YA NO ES UNA COOKIE (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1, gate del owner, 2026-10-01):
// *"Los cambios que hice en el panel, sin dar click en publicar, se veían en la página real,
// enseguida."* Medido: la cookie de 2h (`MODO_EDITOR_MAX_AGE_S` de antes) sobrevivía a cerrar la
// pestaña del editor —el DELETE del `useEffect` de limpieza de `ModoEditorActivo` no corre de
// forma fiable al cerrar la pestaña, sólo en una navegación client-side dentro del panel— y
// mientras vivía, CUALQUIER pestaña del mismo navegador que visitara la tienda real (no sólo el
// iframe del editor) veía el borrador como si estuviera publicado. La marca ahora es POR REQUEST:
// viaja en la URL del iframe (`?editor=1`, § `editor-iframe.ts`) y `proxy.ts` la traduce a un
// header de request SÓLO para esa request — no hay nada que expire ni que limpiar al salir, y una
// pestaña normal del storefront (sin el parámetro) nunca la lleva.
//
// Que el parámetro viaje en una URL pública (copiable, a diferencia de una cookie) no abre una
// puerta nueva: el parámetro NUNCA es la credencial, sólo el flag; sin la sesión OWNER/MANAGER
// activa de ESA request —exactamente el mismo chequeo que antes hacía la cookie— sigue sirviendo
// lo publicado. Compartir el link sólo le muestra el borrador a quien YA podía verlo.

type FilaUsuario = { role: Role; activo: boolean } | null;

/**
 * Lee la marca de la request —el header que `proxy.ts` pone SÓLO cuando el `?editor=1` venía en
 * la URL (nunca confiando en lo que el cliente haya mandado directo, § `proxy.ts`)—. Pura, sin
 * tocar sesión ni base: separa "¿pidieron modo editor?" de "¿tienen permiso?", igual que antes
 * separaba "¿está la cookie?" de "¿la sesión alcanza?".
 */
export function marcaModoEditorDesdeHeaders(h: Headers): boolean {
  return h.get(ENCABEZADO_MODO_EDITOR) === VALOR_MODO_EDITOR;
}

/**
 * EL NÚCLEO PURO de la decisión — aislado para afirmarlo en capa 1 sin tocar headers, sesión ni
 * base (`lib/config/modo-editor-gate.test.ts`). Marca ausente → `false` sin mirar nada más (es la
 * rama que cubre el 99.99% del tráfico: un visitante real). Marca presente pero sin fila, o fila
 * inactiva, o rol insuficiente → `false` también — la tienda sirve lo publicado, nunca un error.
 */
export function decidirModoEditor(marcaPresente: boolean, usuario: FilaUsuario): boolean {
  if (!marcaPresente) return false;
  if (!usuario || !usuario.activo) return false;
  return usuario.role === 'OWNER' || usuario.role === 'MANAGER';
}

/**
 * Resuelve la FILA de `User` a partir de una sesión de Better Auth, dados unos `headers` ya
 * armados. Recibe `Headers` en vez de llamar a `headers()` de `next/headers` ella misma para que
 * el carril de integración (`tests/integracion/modo-editor-gate.test.ts`) pueda probarla con una
 * sesión REAL —firmada por el propio Better Auth— sin el request-scope de Next, que un proceso de
 * `node --test` no tiene. Sobre la fila, no sobre el payload de la sesión — mismo motivo que arriba.
 */
export async function usuarioDeSesion(h: Headers): Promise<FilaUsuario> {
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;
  const usuario = await prisma.user.findUnique({
    where: { id: (session.user as { id: string }).id },
    select: { role: true, activo: true },
  });
  return usuario ?? null;
}

/**
 * El GATE que usa la app real: lee el header de esta request EN VUELO y la sesión
 * (`next/headers`, sólo válido dentro de un Server Component/Route Handler — por eso no se
 * prueba directo, igual que el resto del código que llama a `headers()` en este repo; se
 * verifica por ejecución, capa 3).
 *
 * Sin la marca, retorna ANTES de tocar sesión o base — cero trabajo extra para el tráfico
 * público (el 99.99% de las requests del storefront no la traen). Con la marca, consulta
 * sesión + fila de usuario y aplica el mismo criterio puro de `decidirModoEditor`.
 */
export async function modoEditorActivo(): Promise<boolean> {
  const h = await headers();
  if (!marcaModoEditorDesdeHeaders(h)) return false;
  const usuario = await usuarioDeSesion(h);
  return decidirModoEditor(true, usuario);
}

/**
 * El `noindex` POR REQUEST que `generateMetadata` del storefront agrega cuando el modo editor
 * está activo (§ EDITOR-TIENDA-IFRAME-GATE-1). Extraído como función PURA —sin tocar `headers()`
 * ni `cookies()`— para afirmarla en capa 1: el layout real sólo hace
 * `...metadataRobotsSegunModo(enModoEditor)`, así que probar esta función prueba exactamente lo
 * que el layout va a spreadear, sin necesitar el request-scope de Next.
 *
 * El `X-Robots-Tag` de `next.config.ts` ya cubre el caso "todo el DEPLOYMENT es demo"; esto es un
 * caso nuevo y complementario — "esta request puntual trae el borrador puesto" — y sólo puede
 * resolverse por-request, acá. El `no-store` NO hace falta declararlo aparte: todo el storefront
 * ya es `force-dynamic` (`app/(storefront)/layout.tsx`), así que Next nunca lo cachea, con o sin
 * modo editor — ver § 9.2 de `docs/editor-tienda/DISENO.md`.
 */
export function metadataRobotsSegunModo(
  enModoEditor: boolean,
): { robots: { index: boolean; follow: boolean } } | Record<string, never> {
  return enModoEditor ? { robots: { index: false, follow: false } } : {};
}
