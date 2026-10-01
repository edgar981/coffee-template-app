import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Role } from '@duna/core';
import { prisma } from './fixtures';
import { guardarBorrador } from '@/lib/config/site-content-write';
import { readSiteContent, readSiteContentParaEditor } from '@/lib/config/site-content-read';
import { ENCABEZADO_MODO_EDITOR, VALOR_MODO_EDITOR } from '@/lib/admin/editor-iframe';

// EL VIAJE DE PUNTA A PUNTA del gate de modo editor (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1, reescribe
// EDITOR-TIENDA-IFRAME-GATE-1): una sesión REAL de Better Auth —firmada por el propio motor, no
// simulada a mano— alimenta `usuarioDeSesion` (getSession + la FILA de `User`, nunca el payload de
// la sesión) y su salida alimenta `decidirModoEditor` (el núcleo puro, ya afirmado en capa 1,
// `lib/config/modo-editor-gate.test.ts`). Lo que este archivo prueba que los otros dos NO pueden:
// que el motor de Better Auth y la FILA de Prisma encajan con el criterio puro para los CUATRO
// casos reales (OWNER activo, MANAGER activo, STAFF activo, OWNER inactivo) y para una sesión
// vencida/revocada — y que, de punta a punta, la MARCA (el header que `proxy.ts` deriva de
// `?editor=1`, § `editor-iframe.ts`) decide si el storefront vería el BORRADOR o lo PUBLICADO, y
// que una cookie vieja —la que el mecanismo RETIRADO dejaba en navegadores reales— ya no decide
// nada.
//
// NO SE INVOCA `modoEditorActivo()` NI LA RUTA `app/api/site-content/modo-editor/route.ts`: las dos
// llaman a `headers()`/`cookies()` de `next/headers`, que exigen el request-scope de Next —
// inexistente en un proceso de `node --test` (mismo motivo de `panel-encabezado.test.ts`: se
// reproduce EXACTAMENTE lo que la pieza real hace, con las funciones que sí se pueden invocar
// directo). Tampoco se importa `getSiteContent`/`resolverSegunModo` de `lib/config/site-content.ts`
// — ese módulo trae `import 'server-only'`, que revienta fuera del build de Next (§ CLAUDE.md,
// "`server-only` no resuelve en tsx/node"); se reproduce su lógica con `readSiteContent`/
// `readSiteContentParaEditor`, que SÍ son carril-safe (ninguna de las dos lleva `server-only`).
//
// Por la misma razón, tampoco se prueba acá el `noindex` de `generateMetadata` —también detrás de
// `headers()`/`cookies()`—: su lógica es `metadataRobotsSegunModo(enModoEditor)`, una función PURA
// ya afirmada en capa 1 sobre el MISMO booleano que `decidirModoEditor` produce abajo; no hay una
// segunda decisión que este archivo pueda agregar sin duplicar esa prueba.
//
// `auth` y el módulo del gate entran por IMPORT DINÁMICO tras fijar `TEST`/`BETTER_AUTH_URL`, igual
// que `reset-revoca-sesiones.test.ts`: un import ESTÁTICO se evaluaría ANTES de poder fijar esas
// vars (hoisting de ESM), y `lib/auth.ts` lee `BETTER_AUTH_URL` en su `baseURL` AL CONSTRUIRSE.

const EMAIL_OWNER = 'modo-editor-owner@duna.local';
const EMAIL_MANAGER = 'modo-editor-manager@duna.local';
const EMAIL_STAFF = 'modo-editor-staff@duna.local';
const EMAIL_OWNER_INACTIVO = 'modo-editor-owner-inactivo@duna.local';
const CORREOS = [EMAIL_OWNER, EMAIL_MANAGER, EMAIL_STAFF, EMAIL_OWNER_INACTIVO];
const PASSWORD = 'ClaveDeCarril123';

let auth: typeof import('@/lib/auth')['auth'];
let usuarioDeSesion: typeof import('@/lib/config/modo-editor-gate')['usuarioDeSesion'];
let decidirModoEditor: typeof import('@/lib/config/modo-editor-gate')['decidirModoEditor'];
let marcaModoEditorDesdeHeaders: typeof import('@/lib/config/modo-editor-gate')['marcaModoEditorDesdeHeaders'];

async function crearUsuario(email: string, role: Role, activo: boolean) {
  await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: 'Carril Modo Editor' } });
  await prisma.user.update({ where: { email }, data: { role, activo } });
}

/** El header `Cookie` de una sesión REAL recién iniciada — firmada por Better Auth, no fabricada. */
async function headersDeSesion(email: string): Promise<Headers> {
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
  assert.ok(cookieHeader.length > 0, 'precondición: signInEmail debe dejar al menos un Set-Cookie');
  return new Headers({ cookie: cookieHeader });
}

async function limpiarUsuarios() {
  const usuarios = await prisma.user.findMany({ where: { email: { in: CORREOS } }, select: { id: true } });
  const ids = usuarios.map((u) => u.id);
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.account.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { in: CORREOS } } });
}

before(async () => {
  process.env.TEST = 'true';
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
  ({ auth } = await import('@/lib/auth'));
  ({ usuarioDeSesion, decidirModoEditor, marcaModoEditorDesdeHeaders } =
    await import('@/lib/config/modo-editor-gate'));
  await limpiarUsuarios();
  await crearUsuario(EMAIL_OWNER, 'OWNER', true);
  await crearUsuario(EMAIL_MANAGER, 'MANAGER', true);
  await crearUsuario(EMAIL_STAFF, 'STAFF', true);
  await crearUsuario(EMAIL_OWNER_INACTIVO, 'OWNER', false);
});

after(async () => {
  await limpiarUsuarios();
  await prisma.siteContent.deleteMany({});
  await prisma.$disconnect();
});

test('OWNER activo: la marca decide — sin ella false, con ella true, para la MISMA sesión', async () => {
  const h = await headersDeSesion(EMAIL_OWNER);
  const usuario = await usuarioDeSesion(h);
  assert.deepEqual(usuario, { role: 'OWNER', activo: true });
  assert.equal(decidirModoEditor(false, usuario), false);
  assert.equal(decidirModoEditor(true, usuario), true);
});

test('MANAGER activo: true con la marca puesta', async () => {
  const h = await headersDeSesion(EMAIL_MANAGER);
  const usuario = await usuarioDeSesion(h);
  assert.deepEqual(usuario, { role: 'MANAGER', activo: true });
  assert.equal(decidirModoEditor(true, usuario), true);
});

test('STAFF con sesión válida y la marca puesta: false — el rol no alcanza', async () => {
  const h = await headersDeSesion(EMAIL_STAFF);
  const usuario = await usuarioDeSesion(h);
  assert.deepEqual(usuario, { role: 'STAFF', activo: true });
  assert.equal(decidirModoEditor(true, usuario), false);
});

test('OWNER INACTIVO con sesión válida y la marca puesta: false — `activo` manda sobre el rol', async () => {
  const h = await headersDeSesion(EMAIL_OWNER_INACTIVO);
  const usuario = await usuarioDeSesion(h);
  assert.deepEqual(usuario, { role: 'OWNER', activo: false });
  assert.equal(decidirModoEditor(true, usuario), false);
});

test('sesión revocada (la fila de Session se borró): usuarioDeSesion → null, el gate cae a publicado', async () => {
  const h = await headersDeSesion(EMAIL_OWNER);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL_OWNER } });
  await prisma.session.deleteMany({ where: { userId: user.id } });

  const usuario = await usuarioDeSesion(h);
  assert.equal(usuario, null);
  assert.equal(decidirModoEditor(true, usuario), false);
});

test('cookie de sesión ilegible (sin firma válida): null, nunca un error que tumbe la request', async () => {
  const usuario = await usuarioDeSesion(new Headers({ cookie: 'better-auth.session_token=basura-sin-firmar' }));
  assert.equal(usuario, null);
  assert.equal(decidirModoEditor(true, usuario), false);
});

test('ENTRAR: con el header de marca y sesión OWNER activa, el storefront vería el BORRADOR', async () => {
  await prisma.siteContent.deleteMany({});
  await guardarBorrador({ hero: { titulo: 'Título en borrador — EDITOR-GATE' } });

  const h = await headersDeSesion(EMAIL_OWNER);
  h.set(ENCABEZADO_MODO_EDITOR, VALOR_MODO_EDITOR);
  const usuario = await usuarioDeSesion(h);

  // Mismo criterio que `resolverSegunModo` de `lib/config/site-content.ts` (no importable acá por
  // `server-only`), reproducido con las funciones reales que ese resolver llama —incluida
  // `marcaModoEditorDesdeHeaders`, para ejercitar el camino COMPLETO (header → marca → decisión),
  // no sólo la mitad de la sesión.
  const contenido = decidirModoEditor(marcaModoEditorDesdeHeaders(h), usuario)
    ? (await readSiteContentParaEditor()).contenido
    : await readSiteContent();
  assert.equal(contenido.hero.titulo, 'Título en borrador — EDITOR-GATE');
});

test('SALIR: sin el header de marca, el MISMO borrador sin publicar no se ve — sigue lo publicado', async () => {
  // El borrador del test anterior sigue sin publicar (nadie llamó a `publicarSeccion`).
  const h = await headersDeSesion(EMAIL_OWNER);
  const usuario = await usuarioDeSesion(h);

  const contenido = decidirModoEditor(marcaModoEditorDesdeHeaders(h), usuario)
    ? (await readSiteContentParaEditor()).contenido
    : await readSiteContent();
  assert.notEqual(contenido.hero.titulo, 'Título en borrador — EDITOR-GATE');
});

test('con el header de marca pero rol insuficiente (STAFF): sigue viendo lo PUBLICADO, no el borrador', async () => {
  const h = await headersDeSesion(EMAIL_STAFF);
  h.set(ENCABEZADO_MODO_EDITOR, VALOR_MODO_EDITOR);
  const usuario = await usuarioDeSesion(h);

  const contenido = decidirModoEditor(marcaModoEditorDesdeHeaders(h), usuario)
    ? (await readSiteContentParaEditor()).contenido
    : await readSiteContent();
  assert.notEqual(contenido.hero.titulo, 'Título en borrador — EDITOR-GATE');
});

test('LA COOKIE VIEJA YA NO HABILITA NADA: sesión OWNER + la cookie retirada presente, SIN el header nuevo → publicado', async () => {
  // Reproduce al navegador real que visitó el preview ANTES de este slice: le quedó
  // `modo_editor_tienda=1` puesta. El mecanismo nuevo ni siquiera mira esa cookie —sólo el header
  // que `proxy.ts` deriva de `?editor=1`—, así que una request de ese navegador a la tienda real
  // (sin el parámetro, por tanto sin el header) sigue viendo lo publicado.
  const h = await headersDeSesion(EMAIL_OWNER);
  const cookieVieja = `${h.get('cookie') ?? ''}; modo_editor_tienda=1`;
  h.set('cookie', cookieVieja);
  const usuario = await usuarioDeSesion(h);

  assert.equal(marcaModoEditorDesdeHeaders(h), false);
  const contenido = decidirModoEditor(marcaModoEditorDesdeHeaders(h), usuario)
    ? (await readSiteContentParaEditor()).contenido
    : await readSiteContent();
  assert.notEqual(contenido.hero.titulo, 'Título en borrador — EDITOR-GATE');
});
