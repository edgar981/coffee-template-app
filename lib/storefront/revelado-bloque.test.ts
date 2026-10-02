import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fadeUp, transicionEscalonada, REVELADO_GRUPO_DURACION_S, REVELADO_GRUPO_EASE, REVELADO_GRUPO_PASO_S } from '../animation';
import { variantesRevelaBloque, transicionRevelaBloque } from './revelado-bloque';

// § SECCIONES-ENTRAN-COMO-ORIGEN-1 (2026-10-02) — `RevelarBloque` deja de tener magnitud/disparo
// PROPIOS y pasa a REUSAR los de "El origen" (`fadeUp`+`transicionEscalonada`, lib/animation.ts).
// Estos tests afirman la REUTILIZACIÓN (identidad de referencia/delegación), no una copia de los
// mismos números: si `REVELADO_GRUPO_*` cambiara algún día, este módulo debe moverse CON él, sin que
// nadie tenga que recordar actualizar una segunda copia.

test('variantesRevelaBloque ES fadeUp — la misma referencia, no una copia de sus valores', () => {
  assert.equal(variantesRevelaBloque, fadeUp);
  assert.deepEqual(variantesRevelaBloque.hidden, { opacity: 0, y: 24 });
  assert.deepEqual(variantesRevelaBloque.visible, { opacity: 1, y: 0 });
});

test('transicionRevelaBloque(0) delega en transicionEscalonada(0) — la duración/curva/paso de REVELADO_GRUPO_*', () => {
  assert.deepEqual(transicionRevelaBloque(0), transicionEscalonada(0));
  assert.deepEqual(transicionRevelaBloque(0), { duration: REVELADO_GRUPO_DURACION_S, ease: REVELADO_GRUPO_EASE, delay: 0 });
});

test('transicionRevelaBloque(indice): el retraso escalona REVELADO_GRUPO_PASO_S por hermano, en orden de lectura — igual que transicionEscalonada', () => {
  assert.equal(transicionRevelaBloque(1).delay, REVELADO_GRUPO_PASO_S);
  assert.deepEqual(transicionRevelaBloque(2), transicionEscalonada(2));
  assert.deepEqual(transicionRevelaBloque(5), transicionEscalonada(5));
});

test('transicionRevelaBloque sin argumento: índice 0 por defecto — nunca un retraso NaN', () => {
  const t = transicionRevelaBloque();
  assert.equal(t.delay, 0);
});

test('transicionRevelaBloque(indice negativo): se acota a 0 — un llamador no puede producir un retraso negativo', () => {
  assert.equal(transicionRevelaBloque(-3).delay, 0);
  assert.deepEqual(transicionRevelaBloque(-3), transicionEscalonada(0));
});
