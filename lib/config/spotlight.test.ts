import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etiquetaVarianteSpotlight, productoActivoSpotlight } from './spotlight';

// ─── etiquetaVarianteSpotlight — DATO del producto, nunca un literal inventado ────────────────────

test('etiquetaVarianteSpotlight: con `variante` declarado, la usa tal cual', () => {
  assert.equal(
    etiquetaVarianteSpotlight({ slug: 'x', nombre: 'Café X', variante: 'En grano · 250 g', peso_gramos: 250 }),
    'En grano · 250 g',
  );
});

test('etiquetaVarianteSpotlight: sin `variante`, cae al peso ("N g")', () => {
  assert.equal(
    etiquetaVarianteSpotlight({ slug: 'x', nombre: 'Café X', peso_gramos: 500 }),
    '500 g',
  );
});

test('etiquetaVarianteSpotlight: sin `variante` ni `peso_gramos`, cae al nombre completo', () => {
  assert.equal(
    etiquetaVarianteSpotlight({ slug: 'x', nombre: 'Café Especial' }),
    'Café Especial',
  );
});

test('etiquetaVarianteSpotlight: `variante` vacío ("") se trata como ausente — cae al peso, no a una cadena vacía', () => {
  assert.equal(
    etiquetaVarianteSpotlight({ slug: 'x', nombre: 'Café X', variante: '', peso_gramos: 250 }),
    '250 g',
  );
});

// ─── productoActivoSpotlight — el principal por default, el alterno SÓLO si matchea ───────────────

const PRINCIPAL = { slug: 'cafe-grano-500' };
const ALT_PRESENTACION = { slug: 'cafe-molido-500' };
const ALT_TAMANO = { slug: 'cafe-grano-250' };

test('productoActivoSpotlight: sin elección (null), el principal', () => {
  assert.deepEqual(productoActivoSpotlight(PRINCIPAL, [ALT_PRESENTACION, ALT_TAMANO], null), PRINCIPAL);
});

test('productoActivoSpotlight: slug vacío ("") se trata igual que null — el principal', () => {
  assert.deepEqual(productoActivoSpotlight(PRINCIPAL, [ALT_PRESENTACION, ALT_TAMANO], ''), PRINCIPAL);
});

test('productoActivoSpotlight: el slug matchea el primer alterno', () => {
  assert.deepEqual(
    productoActivoSpotlight(PRINCIPAL, [ALT_PRESENTACION, ALT_TAMANO], 'cafe-molido-500'),
    ALT_PRESENTACION,
  );
});

test('productoActivoSpotlight: el slug matchea el segundo alterno', () => {
  assert.deepEqual(
    productoActivoSpotlight(PRINCIPAL, [ALT_PRESENTACION, ALT_TAMANO], 'cafe-grano-250'),
    ALT_TAMANO,
  );
});

test('productoActivoSpotlight: un slug que NO coincide con NINGÚN alterno cae al principal, no a un producto a medias', () => {
  assert.deepEqual(
    productoActivoSpotlight(PRINCIPAL, [ALT_PRESENTACION, ALT_TAMANO], 'un-slug-que-no-existe'),
    PRINCIPAL,
  );
});

test('productoActivoSpotlight: alternos con `null` (no configurados) no rompen la búsqueda', () => {
  assert.deepEqual(productoActivoSpotlight(PRINCIPAL, [null, ALT_TAMANO], 'cafe-grano-250'), ALT_TAMANO);
  assert.deepEqual(productoActivoSpotlight(PRINCIPAL, [null, null], 'cafe-grano-250'), PRINCIPAL);
});

test('productoActivoSpotlight: lista de alternos vacía — siempre el principal', () => {
  assert.deepEqual(productoActivoSpotlight(PRINCIPAL, [], 'cualquier-cosa'), PRINCIPAL);
});
