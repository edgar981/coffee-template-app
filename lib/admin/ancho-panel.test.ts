import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANCHO_PANEL_DEFECTO, ANCHO_PANEL_MIN, ANCHO_PANEL_MAX,
  anchoPanelMaximo, clampAnchoPanel, anchoPanelDesdeStorage, siguienteAnchoPorTeclado,
} from './ancho-panel';

// EL CONTRATO del ancho ajustable del panel (§ EDITOR-PANEL-ANCHO-1): recortes a los límites
// vigentes de la ventana actual, el paso de teclado, y qué hace un valor guardado inválido o
// ausente — las tres cosas que el spec pide cubrir acá.

test('anchoPanelMaximo: el menor entre el tope absoluto y el 60% de la ventana', () => {
  assert.equal(anchoPanelMaximo(2000), ANCHO_PANEL_MAX, 'ventana ancha: gana el tope absoluto (640)');
  assert.equal(anchoPanelMaximo(1000), 600, '60% de 1000 = 600, por debajo del tope absoluto');
  assert.equal(anchoPanelMaximo(500), 300, '60% de 500 = 300');
});

test('anchoPanelMaximo: ventana no medida (<=0) cae al tope absoluto, no a 0', () => {
  assert.equal(anchoPanelMaximo(0), ANCHO_PANEL_MAX);
  assert.equal(anchoPanelMaximo(-10), ANCHO_PANEL_MAX);
});

test('clampAnchoPanel: dentro de los límites, no toca el valor', () => {
  assert.equal(clampAnchoPanel(400, 2000), 400);
  assert.equal(clampAnchoPanel(ANCHO_PANEL_DEFECTO, 2000), ANCHO_PANEL_DEFECTO);
});

test('clampAnchoPanel: nunca por debajo del mínimo (280)', () => {
  assert.equal(clampAnchoPanel(100, 2000), ANCHO_PANEL_MIN);
  assert.equal(clampAnchoPanel(0, 2000), ANCHO_PANEL_MIN);
  assert.equal(clampAnchoPanel(-50, 2000), ANCHO_PANEL_MIN);
});

test('clampAnchoPanel: nunca por encima del tope absoluto (640), ventana ancha', () => {
  assert.equal(clampAnchoPanel(900, 2000), ANCHO_PANEL_MAX);
});

test('clampAnchoPanel: en una ventana angosta, el tope vigente es el 60% de la ventana', () => {
  // 60% de 900 = 540, por debajo del tope absoluto de 640.
  assert.equal(clampAnchoPanel(900, 900), 540);
  assert.equal(clampAnchoPanel(500, 900), 500, 'un valor ya dentro del 60% no se toca');
});

test('clampAnchoPanel: si el 60% de la ventana cae bajo el mínimo, el mínimo gana', () => {
  // 60% de 400 = 240, por debajo de ANCHO_PANEL_MIN (280) — el panel no se angosta más que eso.
  assert.equal(clampAnchoPanel(240, 400), ANCHO_PANEL_MIN);
  assert.equal(clampAnchoPanel(280, 400), ANCHO_PANEL_MIN);
});

test('clampAnchoPanel: un valor no finito cae al default, no a un ancho inventado por la aritmética', () => {
  assert.equal(clampAnchoPanel(NaN, 2000), ANCHO_PANEL_DEFECTO);
  assert.equal(clampAnchoPanel(Infinity, 2000), ANCHO_PANEL_DEFECTO);
  assert.equal(clampAnchoPanel(-Infinity, 2000), ANCHO_PANEL_DEFECTO);
});

test('anchoPanelDesdeStorage: null (nunca se guardó) cae al default', () => {
  assert.equal(anchoPanelDesdeStorage(null), ANCHO_PANEL_DEFECTO);
});

test('anchoPanelDesdeStorage: un número válido se respeta tal cual (sin recortar — eso es del llamador)', () => {
  assert.equal(anchoPanelDesdeStorage('520'), 520);
  assert.equal(anchoPanelDesdeStorage('999999'), 999999);
});

test('anchoPanelDesdeStorage: basura, cero o negativo caen al default', () => {
  assert.equal(anchoPanelDesdeStorage('no-es-un-numero'), ANCHO_PANEL_DEFECTO);
  assert.equal(anchoPanelDesdeStorage(''), ANCHO_PANEL_DEFECTO);
  assert.equal(anchoPanelDesdeStorage('0'), ANCHO_PANEL_DEFECTO);
  assert.equal(anchoPanelDesdeStorage('-100'), ANCHO_PANEL_DEFECTO);
  assert.equal(anchoPanelDesdeStorage('NaN'), ANCHO_PANEL_DEFECTO);
});

test('siguienteAnchoPorTeclado: izquierda angosta, derecha ensancha, de a 16px', () => {
  assert.equal(siguienteAnchoPorTeclado(400, 'ArrowRight', 2000), 416);
  assert.equal(siguienteAnchoPorTeclado(400, 'ArrowLeft', 2000), 384);
});

test('siguienteAnchoPorTeclado: en el mínimo, ArrowLeft no cruza el piso', () => {
  assert.equal(siguienteAnchoPorTeclado(ANCHO_PANEL_MIN, 'ArrowLeft', 2000), ANCHO_PANEL_MIN);
});

test('siguienteAnchoPorTeclado: en el máximo, ArrowRight no cruza el techo', () => {
  assert.equal(siguienteAnchoPorTeclado(ANCHO_PANEL_MAX, 'ArrowRight', 2000), ANCHO_PANEL_MAX);
});

test('siguienteAnchoPorTeclado: respeta el techo vigente de una ventana angosta, no el absoluto', () => {
  // 60% de 900 = 540: una flecha a la derecha desde 530 no debe pasar de 540, aunque el absoluto sea 640.
  assert.equal(siguienteAnchoPorTeclado(530, 'ArrowRight', 900), 540);
});
