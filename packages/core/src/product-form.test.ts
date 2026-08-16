import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hayCambiosProducto, type EstadoCambiosProducto } from './product-form';
import type { ProductForm } from '@/types/product';

const form: ProductForm = {
  nombre:      'Café Sierra 250 g',
  descripcion: 'Notas a chocolate',
  categoria:   'cafe_molido',
  precio:      '85000',
  costo:       '35000',
  sku:         'SN-001',
  stock:       '50',
  stock_minimo: '10',
  activo:      true,
  peso_gramos: '250',
  variante:    '250 g',
  origen:      'Huila',
  tostado:     'medio',
  slug:        'cafe-sierra-250',
  imagen:      'https://blob/portada.webp',
};

// El caso base: nada tocado en ninguno de los cuatro frentes.
const quieto = (patch: Partial<EstadoCambiosProducto> = {}): EstadoCambiosProducto => ({
  form,
  inicialForm: form,
  imagenCambiada:     false,
  galeriaCambiada:    false,
  moliendasCambiadas: false,
  ...patch,
});

test('sin tocar nada: no hay cambios', () => {
  assert.equal(hayCambiosProducto(quieto()), false);
});

test('un campo del formulario distinto: hay cambios', () => {
  assert.equal(hayCambiosProducto(quieto({ form: { ...form, precio: '90000' } })), true);
});

// Cada uno de los tres frentes NO-formulario, por separado — porque un
// `hayCambios(form, inicial)` a secas se los perdería a los tres.
test('sólo una portada nueva: hay cambios', () => {
  assert.equal(hayCambiosProducto(quieto({ imagenCambiada: true })), true);
});

test('sólo un cambio de galería: hay cambios', () => {
  assert.equal(hayCambiosProducto(quieto({ galeriaCambiada: true })), true);
});

test('sólo un cambio de moliendas: hay cambios', () => {
  assert.equal(hayCambiosProducto(quieto({ moliendasCambiadas: true })), true);
});

// Vaciar la portada se refleja en `form.imagen`, así que lo capta el frente del
// formulario aunque `imagenCambiada` (que es "hay File nuevo") sea false.
test('quitar la portada (form.imagen vacío) cuenta como cambio', () => {
  assert.equal(hayCambiosProducto(quieto({ form: { ...form, imagen: '' } })), true);
});
