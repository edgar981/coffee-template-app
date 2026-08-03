import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  galeriaCompleta, blobsRetirados, sanitizeGaleria, MAX_GALERIA_IMAGENES,
} from './product-gallery';

const PORTADA = '/images/cafe-nayoli-500g-molido-v2.webp';
const STORE   = 'https://abc.public.blob.vercel-storage.com';
const G1      = `${STORE}/dev/productos/toma-1-aaa.webp`;
const G2      = `${STORE}/dev/productos/toma-2-bbb.webp`;

// ─── galeriaCompleta — la dedupe es una GARANTÍA, no una limpieza pendiente ───

test('la portada va primero y las adicionales después', () => {
  assert.deepEqual(galeriaCompleta(PORTADA, [G1, G2]), [PORTADA, G1, G2]);
});

test('la portada repetida dentro de imagenes[] NO se muestra dos veces', () => {
  // Forma exacta de los 4 productos del catálogo: los seeds traen la portada
  // duplicada en la galería y ese dato no se migró a propósito.
  assert.deepEqual(galeriaCompleta(PORTADA, [PORTADA]), [PORTADA]);
  assert.deepEqual(galeriaCompleta(PORTADA, [PORTADA, G1]), [PORTADA, G1]);
  // Y aunque venga en otra posición.
  assert.deepEqual(galeriaCompleta(PORTADA, [G1, PORTADA, G2]), [PORTADA, G1, G2]);
});

test('un producto sin adicionales devuelve longitud 1 — la señal de "sin galería"', () => {
  assert.deepEqual(galeriaCompleta(PORTADA, []), [PORTADA]);
  assert.deepEqual(galeriaCompleta(PORTADA, null), [PORTADA]);
  assert.equal(galeriaCompleta(PORTADA, [PORTADA]).length, 1);
});

test('duplicados entre las propias adicionales también se colapsan', () => {
  assert.deepEqual(galeriaCompleta(PORTADA, [G1, G1, G2]), [PORTADA, G1, G2]);
});

test('sin portada, la galería son solo las adicionales', () => {
  assert.deepEqual(galeriaCompleta('', [G1, G2]), [G1, G2]);
  assert.deepEqual(galeriaCompleta(null, [G1]), [G1]);
});

test('un producto sin ninguna imagen devuelve lista vacía', () => {
  assert.deepEqual(galeriaCompleta('', []), []);
  assert.deepEqual(galeriaCompleta(null, null), []);
});

// ─── blobsRetirados — el diff que dispara el borrado en el servidor ───────────

test('solo se borra lo que salió de la galería', () => {
  assert.deepEqual(blobsRetirados([G1, G2], [G1]), [G2]);
});

test('sin cambios no se borra nada', () => {
  assert.deepEqual(blobsRetirados([G1, G2], [G1, G2]), []);
});

test('vaciar la galería retira todas', () => {
  assert.deepEqual(blobsRetirados([G1, G2], []), [G1, G2]);
  assert.deepEqual(blobsRetirados([G1, G2], null), [G1, G2]);
});

test('agregar no retira nada', () => {
  assert.deepEqual(blobsRetirados([G1], [G1, G2]), []);
  assert.deepEqual(blobsRetirados([], [G1]), []);
  assert.deepEqual(blobsRetirados(null, [G1]), []);
});

test('una toma PROMOVIDA a portada no se borra', () => {
  // Sale de imagenes[] pero sigue en uso como `imagen`: borrarla dejaría al
  // producto apuntando a un blob que acabamos de eliminar.
  assert.deepEqual(blobsRetirados([G1, G2], [G2], [G1]), []);
  assert.deepEqual(blobsRetirados([G1, G2], [], [G1]), [G2]);
});

test('un array previo con duplicados no borra la misma URL dos veces', () => {
  assert.deepEqual(blobsRetirados([G1, G1], []), [G1]);
});

test('la portada previa no entra por esta vía', () => {
  // El reemplazo de portada lo compara el endpoint aparte; acá solo galería.
  assert.deepEqual(blobsRetirados([G1], [G1], [PORTADA]), []);
});

// ─── sanitizeGaleria — lo que llega en el body ───────────────────────────────

test('descarta lo que no sea string no vacío', () => {
  assert.deepEqual(sanitizeGaleria([G1, '', '   ', null, 42, {}, G2]), [G1, G2]);
});

test('recorta espacios y colapsa duplicados', () => {
  assert.deepEqual(sanitizeGaleria([` ${G1} `, G1]), [G1]);
});

test('un payload que no es array se vuelve lista vacía', () => {
  assert.deepEqual(sanitizeGaleria(undefined), []);
  assert.deepEqual(sanitizeGaleria('no soy un array'), []);
  assert.deepEqual(sanitizeGaleria({ 0: G1 }), []);
});

// ─── Tope ────────────────────────────────────────────────────────────────────

test('el tope es una constante nombrada y la valida el servidor', () => {
  assert.equal(MAX_GALERIA_IMAGENES, 6);
  // El tope cuenta ADICIONALES, no la portada: 6 + portada = 7 miniaturas.
  const seis = Array.from({ length: MAX_GALERIA_IMAGENES }, (_, i) => `${STORE}/dev/productos/t${i}.webp`);
  assert.equal(sanitizeGaleria(seis).length, MAX_GALERIA_IMAGENES);
  assert.equal(galeriaCompleta(PORTADA, seis).length, MAX_GALERIA_IMAGENES + 1);
});
