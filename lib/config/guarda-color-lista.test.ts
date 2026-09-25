import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sistemaDeColorDerivado,
  archivosDelSistemaDeColor,
  importadoresDirectosDeRaices,
  archivosLibConfig,
  interseccionSistemaColor,
} from '../../scripts/guarda-color';

// § GUARDA-COLOR-SISTEMA-LISTA-GAP-1 — la CALIBRACIÓN que este slice existe para pasar.
//
// El hueco medido por GUARDA-COLOR-NAYOLI-1 al construir la guarda: la lista a mano `SISTEMA_DE_COLOR`
// no incluía `palette-style.ts`, `fuentes-style.ts`, `forma-style.ts`, `palette-schema.ts` ni
// `theme-mirador.ts`, aunque los cinco emiten las variables CSS o validan el dato de color. El
// reemplazo (§ scripts/guarda-color.ts) deriva el conjunto de "quién importa DIRECTAMENTE los tres
// archivos-raíz del motor" en vez de escribirlo a mano — este archivo prueba que la derivación:
//   (a) contiene el conjunto CONOCIDO de color (los 7 que ya estaban + los 5 del hueco), y
//   (b) NO engorda a un archivo obviamente ajeno al color.

const CONOCIDOS_YA_ESTABAN = [
  'lib/config/palette-derive.ts',
  'lib/config/themes.ts',
  'app/globals.css',
  'lib/config/esquema-style.ts',
  'lib/config/site-content-defaults.ts',
  'lib/config/site-content-schema.ts',
  'lib/config/fuentes.ts',
  'lib/config/formas.ts',
];

const CONOCIDOS_HUECO_MEDIDO = [
  'lib/config/palette-style.ts',
  'lib/config/fuentes-style.ts',
  'lib/config/forma-style.ts',
  'lib/config/palette-schema.ts',
  'lib/config/theme-mirador.ts',
];

// ─── (a) el conjunto derivado CONTIENE el conjunto conocido ────────────────────────────────────────

test('sistemaDeColorDerivado(): contiene los 7 archivos que YA estaban en la lista a mano vieja', () => {
  const rutas = new Set(archivosDelSistemaDeColor());
  for (const conocido of CONOCIDOS_YA_ESTABAN) {
    assert.ok(rutas.has(conocido), `falta un archivo que YA estaba en SISTEMA_DE_COLOR: ${conocido}`);
  }
});

test('sistemaDeColorDerivado(): contiene los 5 archivos del HUECO medido por GUARDA-COLOR-NAYOLI-1 — la calibración central de este slice', () => {
  const rutas = new Set(archivosDelSistemaDeColor());
  for (const gap of CONOCIDOS_HUECO_MEDIDO) {
    assert.ok(rutas.has(gap), `el hueco medido sigue abierto: ${gap} no está en el conjunto derivado`);
  }
});

test('archivosDelSistemaDeColor(): el conjunto EXACTO son los 12 conocidos + email-colors.ts (justificado en el código, importa el motor directo)', () => {
  const esperado = [...CONOCIDOS_YA_ESTABAN, ...CONOCIDOS_HUECO_MEDIDO, 'lib/config/email-colors.ts'].sort();
  assert.deepEqual(archivosDelSistemaDeColor(), esperado);
});

// ─── (b) el conjunto derivado NO engorda a un archivo ajeno al color ───────────────────────────────

test('sistemaDeColorDerivado(): NO incluye un archivo de lib/config/ ajeno al color (site-settings-schema.ts — identidad del negocio, no importa el motor)', () => {
  const rutas = new Set(archivosDelSistemaDeColor());
  assert.ok(!rutas.has('lib/config/site-settings-schema.ts'));
});

test('sistemaDeColorDerivado(): NO incluye los hub-consumers de site-content-defaults.ts que no tienen nada que ver con color (menú, blobs, avisos)', () => {
  const rutas = new Set(archivosDelSistemaDeColor());
  assert.ok(!rutas.has('lib/config/menu-editor.ts'));
  assert.ok(!rutas.has('lib/config/panel-controles.ts'));
  assert.ok(!rutas.has('lib/config/avisos-configuracion.ts'));
  assert.ok(!rutas.has('lib/config/site-content-blobs.ts'));
  assert.ok(!rutas.has('lib/config/site-content-read.ts'));
  assert.ok(!rutas.has('lib/config/site-content-write.ts'));
  assert.ok(!rutas.has('lib/config/site-content.ts'));
});

test('sistemaDeColorDerivado(): NO incluye un archivo de otro dominio del repo (checkout/orders) — queda afuera por construcción, la búsqueda está acotada a lib/config/', () => {
  const rutas = new Set(archivosDelSistemaDeColor());
  assert.ok(!rutas.has('lib/checkout/metodos-pago.ts'));
  assert.ok(!rutas.has('packages/core/src/orders.ts'));
});

test('sistemaDeColorDerivado(): no explota a "todo lib/config/" — el conjunto es una fracción chica del universo real', () => {
  const universo = archivosLibConfig().length;
  const derivado = archivosDelSistemaDeColor().length;
  assert.ok(universo > 20, 'el universo de lib/config/*.ts debería tener más de 20 archivos hoy (si no, este test ya no discrimina nada)');
  assert.ok(derivado < universo / 2, `el conjunto derivado (${derivado}) no debería superar la mitad del universo (${universo}) — señal de que la derivación explotó`);
});

// ─── el mecanismo interno: raíces + importadores directos ──────────────────────────────────────────

test('importadoresDirectosDeRaices(): cada entrada declara un motivo no vacío', () => {
  for (const e of importadoresDirectosDeRaices()) {
    assert.ok(e.motivo.length > 0, `${e.ruta} sin motivo`);
  }
});

test('importadoresDirectosDeRaices(): NO incluye a los propios archivos-raíz (palette-derive/fuentes/formas)', () => {
  const rutas = importadoresDirectosDeRaices().map((e) => e.ruta);
  assert.ok(!rutas.includes('lib/config/palette-derive.ts'));
  assert.ok(!rutas.includes('lib/config/fuentes.ts'));
  assert.ok(!rutas.includes('lib/config/formas.ts'));
});

// ─── el caso "sin intersección" sale sin renderizar (el fast-exit del guard) ───────────────────────

test('interseccionSistemaColor(): una rama que sólo toca archivos ajenos da lista VACÍA (el guard corta antes de levantar Postgres/Playwright)', () => {
  const cambiados = ['app/(storefront)/checkout/page.tsx', 'lib/orders.ts', 'packages/core/src/inventory.ts'];
  assert.deepEqual(interseccionSistemaColor(cambiados), []);
});

test('interseccionSistemaColor(): una rama que toca uno de los 5 archivos del hueco medido SÍ dispara', () => {
  const cambiados = ['lib/config/theme-mirador.ts', 'lib/orders.ts'];
  assert.deepEqual(interseccionSistemaColor(cambiados), ['lib/config/theme-mirador.ts']);
});

test('interseccionSistemaColor(): lista de cambiados vacía da lista vacía', () => {
  assert.deepEqual(interseccionSistemaColor([]), []);
});

// ─── higiene: sin duplicados, todo bajo lib/config/ o una ancla declarada ──────────────────────────

test('sistemaDeColorDerivado(): sin duplicados', () => {
  const rutas = archivosDelSistemaDeColor();
  assert.deepEqual(rutas, [...new Set(rutas)]);
});

test('sistemaDeColorDerivado(): cada entrada declara un motivo no vacío', () => {
  for (const e of sistemaDeColorDerivado()) {
    assert.ok(e.motivo.length > 0, `${e.ruta} sin motivo`);
  }
});
