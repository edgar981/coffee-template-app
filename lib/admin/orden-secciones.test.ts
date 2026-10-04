import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  moverBandaAIndice, moverBandaEnDireccion, moverBandaConDestino, ordenarPorBanda,
  ordenarSeccionesConInstancias,
} from './orden-secciones';
import type { BandaId } from '@/lib/config/site-content-defaults';

const ORDEN: BandaId[] = ['hero', 'marquesina', 'trustBadges', 'featured', 'brandStory'];

test('moverBandaAIndice: mueve el id al destino, preserva el orden relativo del resto', () => {
  assert.deepEqual(moverBandaAIndice(ORDEN, 'trustBadges', 0), ['trustBadges', 'hero', 'marquesina', 'featured', 'brandStory']);
  assert.deepEqual(moverBandaAIndice(ORDEN, 'hero', 4), ['marquesina', 'trustBadges', 'featured', 'brandStory', 'hero']);
  assert.deepEqual(moverBandaAIndice(ORDEN, 'featured', 1), ['hero', 'featured', 'marquesina', 'trustBadges', 'brandStory']);
});

test('moverBandaAIndice: clampa el destino a [0, length-1]', () => {
  assert.deepEqual(moverBandaAIndice(ORDEN, 'brandStory', 99), ['hero', 'marquesina', 'trustBadges', 'featured', 'brandStory']);
  assert.deepEqual(moverBandaAIndice(ORDEN, 'hero', -5), ORDEN);
});

test('moverBandaAIndice: sin cambio real (destino == posición actual) devuelve la MISMA referencia', () => {
  const r = moverBandaAIndice(ORDEN, 'marquesina', 1);
  assert.equal(r, ORDEN, 'debe ser === para que el llamador detecte "no cambió" sin recorrer el array');
});

test('moverBandaAIndice: un id ausente devuelve la misma referencia, sin lanzar', () => {
  const r = moverBandaAIndice(ORDEN, 'origen', 0);
  assert.equal(r, ORDEN);
});

test('moverBandaEnDireccion: swap con el vecino, en cada dirección', () => {
  assert.deepEqual(moverBandaEnDireccion(ORDEN, 'marquesina', -1), ['marquesina', 'hero', 'trustBadges', 'featured', 'brandStory']);
  assert.deepEqual(moverBandaEnDireccion(ORDEN, 'marquesina', 1), ['hero', 'trustBadges', 'marquesina', 'featured', 'brandStory']);
});

test('moverBandaEnDireccion: en el borde no hace nada (misma referencia)', () => {
  assert.equal(moverBandaEnDireccion(ORDEN, 'hero', -1), ORDEN, 'el primero no sube más');
  assert.equal(moverBandaEnDireccion(ORDEN, 'brandStory', 1), ORDEN, 'el último no baja más');
});

test('moverBandaConDestino: pone al arrastrado donde HOY está el destino', () => {
  assert.deepEqual(moverBandaConDestino(ORDEN, 'brandStory', 'hero'), ['brandStory', 'hero', 'marquesina', 'trustBadges', 'featured']);
  assert.deepEqual(moverBandaConDestino(ORDEN, 'hero', 'featured'), ['marquesina', 'trustBadges', 'featured', 'hero', 'brandStory']);
});

test('moverBandaConDestino: un destino que ya no está en orden no mueve nada', () => {
  const r = moverBandaConDestino(ORDEN, 'hero', 'origen' as BandaId);
  assert.equal(r, ORDEN);
});

test('ordenarPorBanda: reordena por bandaId según orden, ignorando los sin bandaId', () => {
  const items = [
    { seccion: 'a', bandaId: 'marquesina' as BandaId },
    { seccion: 'b', bandaId: 'hero' as BandaId },
    { seccion: 'c' }, // sin bandaId — otra página
    { seccion: 'd', bandaId: 'trustBadges' as BandaId },
  ];
  const r = ordenarPorBanda(items, ['hero', 'trustBadges', 'marquesina', 'featured', 'brandStory']);
  assert.deepEqual(r.map((i) => i.seccion), ['b', 'd', 'a', 'c']);
});

test('ordenarPorBanda: un id de orden sin ítem correspondiente se omite (nunca inventa un hueco)', () => {
  const items = [{ seccion: 'x', bandaId: 'hero' as BandaId }];
  const r = ordenarPorBanda(items, ['marquesina', 'hero', 'featured']);
  assert.deepEqual(r.map((i) => i.seccion), ['x']);
});

// § EDITOR-AGREGAR-SECCION-1 — EL TIPO SE ENSANCHÓ DE VERDAD (`<T extends string>`, ver el
// docstring de cabecera): este test ya no necesita el cast a `BandaId` que tenía antes de esta
// tanda — pasa un `string[]` genérico (bandas MÁS un id de instancia) y el genérico lo infiere sin
// ayuda. Confirma el mismo mecanismo que ya valía a nivel de VALOR, ahora también a nivel de TIPO.
test('moverBandaAIndice: funciona igual sobre un string[] que mezcla bandas e ids de instancia', () => {
  const mixto = ['hero', 'inst:a', 'marquesina'];
  const r = moverBandaAIndice(mixto, 'inst:a', 0);
  assert.deepEqual(r, ['inst:a', 'hero', 'marquesina']);
});

test('moverBandaAIndice: sigue funcionando EXACTO sobre un BandaId[] (el llamador de ayer no cambia)', () => {
  assert.deepEqual(moverBandaAIndice(ORDEN, 'trustBadges', 0), ['trustBadges', 'hero', 'marquesina', 'featured', 'brandStory']);
});

// ─── ordenarSeccionesConInstancias ───────────────────────────────────────────────────────────────

test('ordenarSeccionesConInstancias: mezcla bandas e instancias en la secuencia de `orden`', () => {
  const items = [
    { seccion: 'a', bandaId: 'hero' as BandaId },
    { seccion: 'b', bandaId: 'marquesina' as BandaId },
  ];
  const r = ordenarSeccionesConInstancias(items, ['inst:x'], ['hero', 'inst:x', 'marquesina']);
  assert.deepEqual(r, [
    { tipo: 'banda', config: items[0] },
    { tipo: 'instancia', id: 'inst:x' },
    { tipo: 'banda', config: items[1] },
  ]);
});

test('ordenarSeccionesConInstancias: un id de orden que no es banda conocida ni instancia viva se omite', () => {
  const items = [{ seccion: 'a', bandaId: 'hero' as BandaId }];
  const r = ordenarSeccionesConInstancias(items, [], ['hero', 'inst:fantasma', 'inventada']);
  assert.deepEqual(r, [{ tipo: 'banda', config: items[0] }]);
});

test('ordenarSeccionesConInstancias: los ítems sin bandaId (otra página) quedan al final, en su orden original', () => {
  const items = [
    { seccion: 'a', bandaId: 'hero' as BandaId },
    { seccion: 'sin-banda' },
  ];
  const r = ordenarSeccionesConInstancias(items, [], ['hero']);
  assert.deepEqual(r, [
    { tipo: 'banda', config: items[0] },
    { tipo: 'banda', config: items[1] },
  ]);
});
