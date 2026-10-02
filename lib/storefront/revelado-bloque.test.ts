import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  REVELA_BLOQUE_DISTANCIA_PX,
  REVELA_BLOQUE_DURACION_S,
  REVELA_BLOQUE_PASO_S,
  REVELA_BLOQUE_EASE,
  REVELA_BLOQUE_MARGEN,
  variantesRevelaBloque,
  transicionRevelaBloque,
} from './revelado-bloque';

// § SECCIONES-ENTRAN-VIVAS-1 — las cifras son las del spec (`cifras-decision: 50, 0.8, 0.1`).

test('las tres cifras decididas por el orquestador son las que el módulo exporta', () => {
  assert.equal(REVELA_BLOQUE_DISTANCIA_PX, 50);
  assert.equal(REVELA_BLOQUE_DURACION_S, 0.8);
  assert.equal(REVELA_BLOQUE_PASO_S, 0.1);
});

test('la curva es cubic-bezier(0.22, 1, 0.36, 1) — la salida fuerte de §0, no la de REVELADO_GRUPO_EASE', () => {
  assert.deepEqual(REVELA_BLOQUE_EASE, [0.22, 1, 0.36, 1]);
});

test('variantesRevelaBloque: hidden es opacity:0 trasladado 50px (número, no porcentaje); visible es el reposo', () => {
  assert.deepEqual(variantesRevelaBloque.hidden, { opacity: 0, y: 50 });
  assert.deepEqual(variantesRevelaBloque.visible, { opacity: 1, y: 0 });
});

test('transicionRevelaBloque(0): sin retraso, la duración/curva de siempre', () => {
  assert.deepEqual(transicionRevelaBloque(0), { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0 });
});

test('transicionRevelaBloque(indice): el retraso escalona 0.1s por hermano, en orden de lectura', () => {
  assert.equal(transicionRevelaBloque(1).delay, 0.1);
  assert.equal(transicionRevelaBloque(2).delay, 0.2);
  assert.equal(transicionRevelaBloque(5).delay, 0.5);
});

test('transicionRevelaBloque sin argumento: índice 0 por defecto — nunca un retraso NaN', () => {
  const t = transicionRevelaBloque();
  assert.equal(t.delay, 0);
});

test('transicionRevelaBloque(indice negativo): se acota a 0 — un llamador no puede producir un retraso negativo', () => {
  assert.equal(transicionRevelaBloque(-3).delay, 0);
});

test('REVELA_BLOQUE_MARGEN: sólo el fondo se encoge — el tope queda en el borde real del viewport, § SECCIONES-ENTRAN-UNA-VEZ-1', () => {
  assert.equal(REVELA_BLOQUE_MARGEN, '0px 0px -20% 0px');
  const partes = REVELA_BLOQUE_MARGEN.split(' ');
  assert.equal(partes.length, 4);
  assert.equal(partes[0], '0px', 'el tope NO se encoge: un bloque ya visible al cargar (o alcanzado de un salto) nunca debe quedar fuera de la caja activa');
  assert.equal(partes[1], '0px');
  assert.equal(partes[2], '-20%', 'el fondo sigue encogido: conserva el disparo tardío al entrar scrolleando desde abajo');
  assert.equal(partes[3], '0px');
});
