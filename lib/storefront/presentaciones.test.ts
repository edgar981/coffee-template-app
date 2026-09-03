import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tarjetasDePresentaciones, gridColsPresentaciones } from './presentaciones';
import { DEFAULTS } from '../config/site-content-defaults';
import { hrefCategoria } from '../productos/categorias';

// Capa 1 del criterio de tarjeta presente (OR, no AND) y del grid por conteo. La presencia por-tarjeta
// vive ACÁ (componente, puro) y no en el resolver — por eso se puede afirmar sin renderizar.

const base = DEFAULTS.presentaciones;

test('Nayoli (defaults): exactamente 2 tarjetas, con los destinos de hoy', () => {
  const t = tarjetasDePresentaciones(base);
  assert.equal(t.length, 2);
  assert.equal(t[0].href, hrefCategoria('Café en Grano'));
  assert.equal(t[1].href, hrefCategoria('Café Molido'));
});

test('slot 3-4 vacíos → no se muestran (Nayoli queda en 2)', () => {
  const t = tarjetasDePresentaciones({ ...base, label3: '', imagen3: '', label4: '', imagen4: '' });
  assert.equal(t.length, 2);
});

test('OR, no AND: una tarjeta con TÍTULO pero SIN imagen SÍ se muestra', () => {
  const t = tarjetasDePresentaciones({ ...base, label3: 'Tortas', copy3: 'Recién horneadas', imagen3: '', categoria3: 'Tortas' });
  assert.equal(t.length, 3);
  assert.equal(t[2].label, 'Tortas');
  assert.equal(t[2].img, ''); // el componente pinta el hueco; NO desaparece
  assert.equal(t[2].href, hrefCategoria('Tortas'));
});

test('OR, no AND: una tarjeta con IMAGEN pero SIN título SÍ se muestra', () => {
  const t = tarjetasDePresentaciones({ ...base, label3: '', imagen3: '/x.webp' });
  assert.equal(t.length, 3);
  assert.equal(t[2].img, '/x.webp');
});

test('4 tarjetas: todas llenas resuelven a 4', () => {
  const t = tarjetasDePresentaciones({
    ...base,
    label3: 'Galletas', imagen3: '/g.webp', categoria3: 'Galletas',
    label4: 'Postres',  imagen4: '/p.webp', categoria4: 'Postres',
  });
  assert.equal(t.length, 4);
  assert.equal(t[3].href, hrefCategoria('Postres'));
});

test('las tarjetas 1-2 son REQUERIDAS: aunque estén "vacías" en la config, se muestran (mínimo 2)', () => {
  // Nunca ocurre con los defaults (1-2 caen al default de Nayoli), pero fija que el mínimo es del SLOT,
  // no del contenido — el filtro nunca poda un slot requerido.
  const t = tarjetasDePresentaciones({ ...base, label1: '', imagen1: '', label2: '', imagen2: '' });
  assert.equal(t.length, 2);
});

test('grid por conteo: 2→cols-2, 3→cols-3, 4→2×2 (cols-2)', () => {
  assert.equal(gridColsPresentaciones(2), 'md:grid-cols-2');
  assert.equal(gridColsPresentaciones(3), 'md:grid-cols-3');
  assert.equal(gridColsPresentaciones(4), 'md:grid-cols-2'); // 2×2, NO cols-4 (ilegible a 800px)
});
