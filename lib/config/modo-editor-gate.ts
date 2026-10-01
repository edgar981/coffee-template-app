import { cookies, headers } from 'next/headers';
import { auth } from '@/lib/auth';
import prisma, { type Role } from '@duna/core';

// EL GATE DEL MODO EDITOR del storefront (§ EDITOR-TIENDA-IFRAME-GATE-1, slice 1 del plan de
// `docs/editor-tienda/DISENO.md`). Paso 1 de un editor de verdad: sin UI todavía, sólo el
// mecanismo que decide si ESTA request ve el borrador o lo publicado.
//
// LA COOKIE SOLA NO ALCANZA — nunca gatea el acceso por sí misma. Es sólo el FLAG de activación;
// quien decide es la MISMA sesión server-side que ya gatea el panel (`app/(admin)/admin/
// layout.tsx`): sesión válida + rol OWNER/MANAGER + `activo` en la FILA de `User`, jamás en el
// payload de la cookie de sesión. Replica ese gate, el MÁS ESTRICTO de los dos que conviven en el
// repo (el otro es `requireAdmin` de las rutas `/api/site-content/*`, que no chequea `activo`) —
// mismo motivo que ahí: si el gate dependiera de que `additionalFields.activo` poblara la sesión y
// algún día no lo hiciera, fallaría ABIERTO (`undefined !== false`).

export const COOKIE_MODO_EDITOR = 'modo_editor_tienda';

// Vida CORTA (2h) y RENOVABLE: una sesión de edición no debería sobrevivir medio día sin que
// alguien la esté usando, y "renovable" significa que volver a llamar al POST (seguir editando)
// reemite la cookie con una expiración nueva — no hay un mecanismo de sliding-renewal aparte.
export const MODO_EDITOR_MAX_AGE_S = 60 * 60 * 2;

type FilaUsuario = { role: Role; activo: boolean } | null;

/**
 * EL NÚCLEO PURO de la decisión — aislado para afirmarlo en capa 1 sin tocar cookies, sesión ni
 * base (`lib/config/modo-editor-gate.test.ts`). Cookie ausente → `false` sin mirar nada más (es la
 * rama que cubre el 99.99% del tráfico: un visitante real). Cookie presente pero sin fila, o fila
 * inactiva, o rol insuficiente → `false` también — la tienda sirve lo publicado, nunca un error.
 */
export function decidirModoEditor(cookiePresente: boolean, usuario: FilaUsuario): boolean {
  if (!cookiePresente) return false;
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
 * El GATE que usa la app real: lee la cookie y la sesión EN VUELO de esta request
 * (`next/headers`, sólo válido dentro de un Server Component/Route Handler — por eso no se
 * prueba directo, igual que el resto del código que llama a `headers()`/`cookies()` en este
 * repo; se verifica por ejecución, capa 3).
 *
 * Sin la cookie, retorna ANTES de tocar sesión o base — cero trabajo extra para el tráfico
 * público. Con la cookie, consulta sesión + fila de usuario y aplica el mismo criterio puro
 * de `decidirModoEditor`.
 */
export async function modoEditorActivo(): Promise<boolean> {
  const jar = await cookies();
  const cookiePresente = jar.has(COOKIE_MODO_EDITOR);
  if (!cookiePresente) return false;
  const usuario = await usuarioDeSesion(await headers());
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
