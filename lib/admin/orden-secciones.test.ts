import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moverBandaAIndice, moverBandaEnDireccion, moverBandaConDestino, ordenarPorBanda } from './orden-secciones';
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

// § SECCIONES-INSTANCIAS-1 (no tocó este archivo — ver el docstring de cabecera para el porqué): el
// MECANISMO (mover un valor dentro de un array corto) no sabe ni le importa que un valor sea un
// `BandaId` real — es sólo una CADENA que el array contiene. Este test lo confirma a nivel de
// VALOR (con un cast, ya que el TIPO sigue siendo `BandaId[]`, sin tocar): el día que
// `TiendaPaginas.tsx` ensanche su `ordenLocal` para aceptar instancias, estas tres funciones no
// necesitan cambiar NADA — sólo su firma de tipos.
test('moverBandaAIndice: mecánicamente funciona igual con un id-de-instancia disfrazado de BandaId (el tipo no cambia; el valor sí podría ser cualquier string el día de mañana)', () => {
  const conInstancia = ['hero', 'inst:a', 'marquesina'] as unknown as BandaId[];
  const r = moverBandaAIndice(conInstancia, 'inst:a' as BandaId, 0);
  assert.deepEqual(r, ['inst:a', 'hero', 'marquesina']);
});
