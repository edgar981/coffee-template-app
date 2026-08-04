import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  puedeGuardarProducto, faltanObligatorios, CAMPOS_OBLIGATORIOS_PRODUCTO,
} from './product-form';
import { EMPTY_PRODUCT_FORM } from '@/constants/product';
import type { ProductForm } from '@/types/product';

// El formulario de producto se puede guardar con SOLO los tres campos marcados
// con `*`. Estos tests existen porque el predicado vivía inline en el JSX del
// botón, sin cobertura: cualquier requisito extra que se colara ahí bloquearía
// el ALTA sin romper la edición —que llega con todo poblado— y pasaría los
// smoke tests, que históricamente se hicieron sobre editar.

/** Lo mínimo con lo que un alta debe poder guardarse. */
const MINIMO: Pick<ProductForm, 'nombre' | 'categoria' | 'precio'> =
  { nombre: 'Café QA', categoria: 'cafe_grano', precio: '35000' };

// ─── El caso que importa: CREAR ──────────────────────────────────────────────

test('CREAR: con los tres obligatorios y NADA más, se puede guardar', () => {
  assert.equal(puedeGuardarProducto(MINIMO, false), true);
});

test('CREAR: la imagen NO es obligatoria — el alta arranca sin portada', () => {
  // El endpoint tampoco la exige (`imagen: body.imagen || ''`). Si algún día
  // alguien la mete en el predicado, este test cae antes que el operador.
  assert.equal(puedeGuardarProducto({ ...MINIMO }, false), true);
  assert.deepEqual([...CAMPOS_OBLIGATORIOS_PRODUCTO], ['nombre', 'categoria', 'precio']);
  assert.ok(!CAMPOS_OBLIGATORIOS_PRODUCTO.includes('imagen' as never));
});

test('CREAR: el formulario vacío NO se puede guardar', () => {
  assert.equal(puedeGuardarProducto(EMPTY_PRODUCT_FORM, false), false);
});

test('CREAR: falta cualquiera de los tres → bloqueado, uno por uno', () => {
  for (const campo of CAMPOS_OBLIGATORIOS_PRODUCTO) {
    const sinEse = { ...MINIMO, [campo]: '' };
    assert.equal(puedeGuardarProducto(sinEse, false), false, `debería bloquear sin ${campo}`);
  }
});

test('un valor de solo espacios no cuenta como lleno', () => {
  assert.equal(puedeGuardarProducto({ ...MINIMO, nombre: '   ' }, false), false);
});

test('precio "0" es un valor, no un vacío', () => {
  // `!'0'` es false en JS, pero conviene fijarlo: un producto gratis o de
  // cortesía no puede quedar bloqueado por una comprobación de falsy.
  assert.equal(puedeGuardarProducto({ ...MINIMO, precio: '0' }, false), true);
});

// ─── EDITAR: mismo predicado, y por eso enmascaraba el problema ──────────────

test('EDITAR: un producto poblado siempre cumple, aunque el predicado pida de más', () => {
  const editado: typeof MINIMO =
    { nombre: 'Café Nayoli — Molido 500 g', categoria: 'cafe_molido', precio: '35000' };
  assert.equal(puedeGuardarProducto(editado, false), true);
});

// ─── Estado de guardado ──────────────────────────────────────────────────────

test('mientras se guarda queda bloqueado, aunque los campos estén completos', () => {
  assert.equal(puedeGuardarProducto(MINIMO, true), false);
});

test('al terminar (con éxito o error) vuelve a habilitarse', () => {
  assert.equal(puedeGuardarProducto(MINIMO, false), true);
});

// ─── faltanObligatorios, por separado ────────────────────────────────────────

test('faltanObligatorios distingue completo de incompleto', () => {
  assert.equal(faltanObligatorios(MINIMO), false);
  assert.equal(faltanObligatorios({ ...MINIMO, categoria: '' }), true);
});
