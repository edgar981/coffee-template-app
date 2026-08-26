import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imagenesDe, blobsAReemplazar, blobsHuerfanos } from './site-content-blobs';
import type { SeccionDef } from './site-content-defaults';

// Registro SINTÉTICO: una sección de collage (4 imágenes fijas, como brandStory) y una REPEATER
// (como será Testimonios). No depende del REGISTRY real —que en esta rama sólo tiene el hero—,
// y de paso demuestra que el camino del repeater ya funciona.
const REG: Record<string, SeccionDef> = {
  collage:     { label: 'C', ocultable: true, imagenes: ['i1', 'i2', 'i3', 'i4'], campos: {} },
  testimonios: { label: 'T', ocultable: true, repeater: { itemsKey: 'items', campos: {} }, imagenes: ['foto'], campos: {} },
};

// ── imagenesDe ────────────────────────────────────────────────────────────────

test('imagenesDe: junta las 4 de una sección de collage', () => {
  const doc = { collage: { i1: 'a', i2: 'b', i3: 'c', i4: 'd' } };
  assert.deepEqual(imagenesDe(doc, REG).sort(), ['a', 'b', 'c', 'd']);
});

test('imagenesDe REPEATER: junta la imagen de CADA item, ignora el sin-foto y la basura (listo para Testimonios)', () => {
  const doc = { testimonios: { items: [{ foto: 'a', txt: 'x' }, { foto: 'b' }, { txt: 'sin foto' }, 'basura'] } };
  assert.deepEqual(imagenesDe(doc, REG).sort(), ['a', 'b']);
});

test('imagenesDe SOFT: doc/sección/valores ausentes o mal formados → sin imágenes, no lanza', () => {
  assert.deepEqual(imagenesDe(null, REG), []);
  assert.deepEqual(imagenesDe({ collage: 'no-obj' }, REG), []);
  assert.deepEqual(imagenesDe({ collage: { i1: '', i2: '  ' } }, REG), []); // vacíos no cuentan
});

// ── blobsAReemplazar: SET-diff, NO por índice (modo a) ──────────────────────────

test('SWAP: reordenar slots NO borra nada (set-diff) — falla con un diff por índice', () => {
  // Discriminador del modo (a): un diff por índice (viejas[i] !== nuevas[i]) borraría A y B al
  // intercambiarlos, aunque las dos siguen en uso.
  assert.deepEqual(blobsAReemplazar(['A', 'B', 'C', 'D'], ['B', 'A', 'C', 'D']), []);
});

test('blobsAReemplazar: una URL que desaparece se borra; una que sigue (aunque movida) no', () => {
  assert.deepEqual(blobsAReemplazar(['A', 'B'], ['B']), ['A']);          // A desapareció
  assert.deepEqual(blobsAReemplazar(['A', 'B'], ['B', 'A', 'C']), []);   // ambas siguen
});

// ── blobsHuerfanos: EN USO = content ∪ borrador ─────────────────────────────────

test('GUARDAR: imagen reemplazada en BORRADOR pero aún en PUBLICADO NO se borra (modo b)', () => {
  // Discriminador del modo (b): diffear contra la vista mezclada (content efectiva) borraría A,
  // que sigue publicada. La unión content ∪ borrador la protege.
  const antes   = { content: { collage: { i1: 'A', i2: 'B', i3: 'C', i4: 'D' } }, borrador: null };
  const despues = {
    content:  { collage: { i1: 'A', i2: 'B', i3: 'C', i4: 'D' } }, // publicado INTACTO
    borrador: { collage: { i1: 'X', i2: 'B', i3: 'C', i4: 'D' } }, // draft: i1 A→X
  };
  assert.deepEqual(blobsHuerfanos(antes, despues, REG), []); // A vive en publicado; X vive en el draft
});

test('PUBLICAR: la imagen vieja publicada, ya sin referencias, SÍ se borra', () => {
  const antes = {
    content:  { collage: { i1: 'A', i2: 'B', i3: 'C', i4: 'D' } },
    borrador: { collage: { i1: 'X', i2: 'B', i3: 'C', i4: 'D' } },
  };
  const despues = { content: { collage: { i1: 'X', i2: 'B', i3: 'C', i4: 'D' } }, borrador: null };
  assert.deepEqual(blobsHuerfanos(antes, despues, REG), ['A']); // A ya no está en ningún lado
});

test('DESCARTAR: la imagen del borrador abandonado SÍ se borra; la publicada queda', () => {
  const antes = {
    content:  { collage: { i1: 'A', i2: 'B', i3: 'C', i4: 'D' } },
    borrador: { collage: { i1: 'X', i2: 'B', i3: 'C', i4: 'D' } },
  };
  const despues = { content: { collage: { i1: 'A', i2: 'B', i3: 'C', i4: 'D' } }, borrador: null };
  assert.deepEqual(blobsHuerfanos(antes, despues, REG), ['X']); // X (draft abandonado) se limpia; A queda
});
