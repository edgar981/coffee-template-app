import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirModoEditor,
  marcaModoEditorDesdeHeaders,
  metadataRobotsSegunModo,
} from '@/lib/config/modo-editor-gate';
import { ENCABEZADO_MODO_EDITOR, VALOR_MODO_EDITOR } from '@/lib/admin/editor-iframe';

// EL NÚCLEO PURO del gate (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1, reescribe EDITOR-TIENDA-IFRAME-GATE-1):
// `decidirModoEditor` y `marcaModoEditorDesdeHeaders` son las ÚNICAS piezas de `modo-editor-gate.ts`
// que no tocan sesión ni base — por eso viven acá, en capa 1. El resto (`usuarioDeSesion`,
// `modoEditorActivo`) se afirma en el carril (`tests/integracion/modo-editor-gate.test.ts`) y por
// ejecución, respectivamente — mismo criterio que el resto del código que llama a `headers()` de
// `next/headers` en este repo.

test('sin la marca, false sin importar la fila — ni siquiera una fila OWNER activa alcanza', () => {
  assert.equal(decidirModoEditor(false, { role: 'OWNER', activo: true }), false);
  assert.equal(decidirModoEditor(false, null), false);
});

test('marca presente, sin fila (sesión sin usuario o usuario borrado) → false', () => {
  assert.equal(decidirModoEditor(true, null), false);
});

test('marca presente, fila inactiva → false aunque el rol sea OWNER/MANAGER', () => {
  assert.equal(decidirModoEditor(true, { role: 'OWNER', activo: false }), false);
  assert.equal(decidirModoEditor(true, { role: 'MANAGER', activo: false }), false);
});

test('marca presente, rol insuficiente (STAFF) activo → false', () => {
  assert.equal(decidirModoEditor(true, { role: 'STAFF', activo: true }), false);
});

test('marca presente, OWNER activo → true', () => {
  assert.equal(decidirModoEditor(true, { role: 'OWNER', activo: true }), true);
});

test('marca presente, MANAGER activo → true', () => {
  assert.equal(decidirModoEditor(true, { role: 'MANAGER', activo: true }), true);
});

// LA MARCA ES EL HEADER, NUNCA UNA COOKIE (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1): el mecanismo viejo
// leía `cookies().has(COOKIE_MODO_EDITOR)`; el nuevo SÓLO mira el header que `proxy.ts` pone por
// request. Una cookie vieja —la que pudo quedar en un navegador real que visitó el preview antes
// de este cambio— no tiene forma de activar nada: `marcaModoEditorDesdeHeaders` ni siquiera lee
// `Cookie`.
test('marcaModoEditorDesdeHeaders: el header exacto → true', () => {
  assert.equal(
    marcaModoEditorDesdeHeaders(new Headers({ [ENCABEZADO_MODO_EDITOR]: VALOR_MODO_EDITOR })),
    true,
  );
});

test('marcaModoEditorDesdeHeaders: sin header → false', () => {
  assert.equal(marcaModoEditorDesdeHeaders(new Headers()), false);
});

test('marcaModoEditorDesdeHeaders: la cookie vieja (modo_editor_tienda) presente, sin el header → false', () => {
  const h = new Headers({ cookie: 'modo_editor_tienda=1' });
  assert.equal(marcaModoEditorDesdeHeaders(h), false);
});

test('marcaModoEditorDesdeHeaders: un valor distinto de "1" en el header → false, no basta con que exista', () => {
  assert.equal(marcaModoEditorDesdeHeaders(new Headers({ [ENCABEZADO_MODO_EDITOR]: 'true' })), false);
});

// EL NOINDEX POR REQUEST (§ 9.2 DISENO.md): la pieza que `generateMetadata` del storefront
// spreadea tal cual. Probarla acá prueba exactamente lo que el layout hace, sin el request-scope
// de Next que `headers()`/`cookies()` exigirían.
test('metadataRobotsSegunModo: modo editor ACTIVO → noindex; INACTIVO → objeto vacío (nada que sobreescriba el default)', () => {
  assert.deepEqual(metadataRobotsSegunModo(true), { robots: { index: false, follow: false } });
  assert.deepEqual(metadataRobotsSegunModo(false), {});
});
