import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENU_ITEM_IDS, type MenuContent } from '@/lib/config/site-content-defaults';
import { etiquetaOpcionMenu, intercambiarPosicionMenu } from '@/lib/config/menu-editor';

// § CROMO-MENU-PANEL-EDITOR-1. Las dos piezas de conducta del editor BESPOKE del menú que no son
// del modelo (ese ya está probado en `menu-como-dato.test.ts`): la etiqueta de una opción de
// reorden, y el swap que hace IMPOSIBLE que el editor produzca dos posiciones con el mismo ítem.

const MENU_HOY: Pick<MenuContent, 'labelTienda' | 'labelSuscripciones' | 'labelNosotros' | 'posicion1' | 'posicion2' | 'posicion3'> = {
  labelTienda: 'Tienda',
  labelSuscripciones: 'Suscripciones',
  labelNosotros: 'Nosotros',
  posicion1: 'tienda',
  posicion2: 'suscripciones',
  posicion3: 'nosotros',
};

// ── etiquetaOpcionMenu ───────────────────────────────────────────────────────────────────────────

test('etiquetaOpcionMenu: con el label de hoy, devuelve el label tal cual', () => {
  assert.equal(etiquetaOpcionMenu(MENU_HOY, 'tienda'), 'Tienda');
  assert.equal(etiquetaOpcionMenu(MENU_HOY, 'suscripciones'), 'Suscripciones');
  assert.equal(etiquetaOpcionMenu(MENU_HOY, 'nosotros'), 'Nosotros');
});

test('etiquetaOpcionMenu: con un label editado, devuelve el label EN VIVO', () => {
  const form = { ...MENU_HOY, labelTienda: 'Nuestro café' };
  assert.equal(etiquetaOpcionMenu(form, 'tienda'), 'Nuestro café');
});

test('etiquetaOpcionMenu: label vacío (o sólo espacios) cae al nombre CANÓNICO — nunca una opción muda', () => {
  assert.equal(etiquetaOpcionMenu({ ...MENU_HOY, labelTienda: '' }, 'tienda'), 'Tienda');
  assert.equal(etiquetaOpcionMenu({ ...MENU_HOY, labelNosotros: '   ' }, 'nosotros'), 'Nosotros');
});

// ── intercambiarPosicionMenu ─────────────────────────────────────────────────────────────────────

test('intercambiarPosicionMenu: elegir el mismo valor que ya tenía la posición es un no-op', () => {
  assert.deepEqual(intercambiarPosicionMenu(MENU_HOY, 'posicion1', 'tienda'), {});
});

test('intercambiarPosicionMenu: elegir un ítem que ocupaba OTRA posición hace SWAP (las dos cambian)', () => {
  // posicion1='tienda' pide 'nosotros' (hoy en posicion3) → posicion1↔posicion3 se intercambian.
  assert.deepEqual(intercambiarPosicionMenu(MENU_HOY, 'posicion1', 'nosotros'), { posicion1: 'nosotros', posicion3: 'tienda' });
});

test('intercambiarPosicionMenu: swap en la OTRA dirección da el resultado simétrico', () => {
  assert.deepEqual(intercambiarPosicionMenu(MENU_HOY, 'posicion3', 'tienda'), { posicion3: 'tienda', posicion1: 'nosotros' });
});

test('intercambiarPosicionMenu: el resultado, aplicado, es SIEMPRE una permutación de MENU_ITEM_IDS — para TODA combinación de campo×valor de partida', () => {
  const campos = ['posicion1', 'posicion2', 'posicion3'] as const;
  // Las 6 permutaciones posibles de las 3 posiciones, como puntos de partida.
  const permutaciones: [string, string, string][] = [
    ['tienda', 'suscripciones', 'nosotros'], ['tienda', 'nosotros', 'suscripciones'],
    ['suscripciones', 'tienda', 'nosotros'], ['suscripciones', 'nosotros', 'tienda'],
    ['nosotros', 'tienda', 'suscripciones'], ['nosotros', 'suscripciones', 'tienda'],
  ];
  for (const [p1, p2, p3] of permutaciones) {
    const inicio = { posicion1: p1, posicion2: p2, posicion3: p3 };
    for (const campo of campos) {
      for (const nuevoId of MENU_ITEM_IDS) {
        const parcial = intercambiarPosicionMenu(inicio, campo, nuevoId);
        const resultado = { ...inicio, ...parcial };
        assert.deepEqual(
          [resultado.posicion1, resultado.posicion2, resultado.posicion3].slice().sort(),
          ['nosotros', 'suscripciones', 'tienda'],
          `campo=${campo} nuevoId=${nuevoId} inicio=${JSON.stringify(inicio)} → ${JSON.stringify(resultado)}`,
        );
      }
    }
  }
});
