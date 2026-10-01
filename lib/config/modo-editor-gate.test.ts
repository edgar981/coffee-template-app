import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirModoEditor, metadataRobotsSegunModo } from '@/lib/config/modo-editor-gate';

// EL NÚCLEO PURO del gate (§ EDITOR-TIENDA-IFRAME-GATE-1): `decidirModoEditor` es la ÚNICA pieza
// de `modo-editor-gate.ts` que no toca cookies, sesión ni base — por eso vive acá, en capa 1. El
// resto (`usuarioDeSesion`, `modoEditorActivo`) se afirma en el carril
// (`tests/integracion/modo-editor-gate.test.ts`) y por ejecución, respectivamente — mismo criterio
// que el resto del código que llama a `headers()`/`cookies()` de `next/headers` en este repo.

test('sin cookie, false sin importar la fila — ni siquiera una fila OWNER activa alcanza', () => {
  assert.equal(decidirModoEditor(false, { role: 'OWNER', activo: true }), false);
  assert.equal(decidirModoEditor(false, null), false);
});

test('cookie presente, sin fila (sesión sin usuario o usuario borrado) → false', () => {
  assert.equal(decidirModoEditor(true, null), false);
});

test('cookie presente, fila inactiva → false aunque el rol sea OWNER/MANAGER', () => {
  assert.equal(decidirModoEditor(true, { role: 'OWNER', activo: false }), false);
  assert.equal(decidirModoEditor(true, { role: 'MANAGER', activo: false }), false);
});

test('cookie presente, rol insuficiente (STAFF) activo → false', () => {
  assert.equal(decidirModoEditor(true, { role: 'STAFF', activo: true }), false);
});

test('cookie presente, OWNER activo → true', () => {
  assert.equal(decidirModoEditor(true, { role: 'OWNER', activo: true }), true);
});

test('cookie presente, MANAGER activo → true', () => {
  assert.equal(decidirModoEditor(true, { role: 'MANAGER', activo: true }), true);
});

// EL NOINDEX POR REQUEST (§ 9.2 DISENO.md): la pieza que `generateMetadata` del storefront
// spreadea tal cual. Probarla acá prueba exactamente lo que el layout hace, sin el request-scope
// de Next que `headers()`/`cookies()` exigirían.
test('metadataRobotsSegunModo: modo editor ACTIVO → noindex; INACTIVO → objeto vacío (nada que sobreescriba el default)', () => {
  assert.deepEqual(metadataRobotsSegunModo(true), { robots: { index: false, follow: false } });
  assert.deepEqual(metadataRobotsSegunModo(false), {});
});
