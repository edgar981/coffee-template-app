import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPCIONES_ORDEN,
  ordenarCatalogo,
  contarDisponibilidad,
  rangoPrecioCatalogo,
  filtrarCatalogo,
  type OrdenCatalogo,
  type DisponibilidadFiltro,
} from './filtrar-ordenar';

// ─── OPCIONES_ORDEN ───────────────────────────────────────────────────────────────────────────

test('OPCIONES_ORDEN: valores únicos, sin duplicados', () => {
  const valores = OPCIONES_ORDEN.map((o) => o.value);
  assert.equal(new Set(valores).size, valores.length);
});

// ─── ordenarCatalogo ──────────────────────────────────────────────────────────────────────────

const CATALOGO = [
  { nombre: 'Café Nariño', precio: 30000, bestseller: false },
  { nombre: 'Café Huila', precio: 45000, bestseller: true },
  { nombre: 'café Cauca', precio: 20000, bestseller: false },
];

test('featured: devuelve el orden de ENTRADA tal cual, sin reordenar', () => {
  const out = ordenarCatalogo(CATALOGO, 'featured');
  assert.deepEqual(out.map((p) => p.nombre), ['Café Nariño', 'Café Huila', 'café Cauca']);
});

test('featured: no MUTA la lista de entrada (es una copia)', () => {
  const copia = [...CATALOGO];
  ordenarCatalogo(copia, 'price_asc');
  assert.deepEqual(copia, CATALOGO);
});

test('price_asc: menor a mayor', () => {
  const out = ordenarCatalogo(CATALOGO, 'price_asc');
  assert.deepEqual(out.map((p) => p.precio), [20000, 30000, 45000]);
});

test('price_desc: mayor a menor', () => {
  const out = ordenarCatalogo(CATALOGO, 'price_desc');
  assert.deepEqual(out.map((p) => p.precio), [45000, 30000, 20000]);
});

test('name_asc: alfabético (localeCompare, no case-sensitive estricto)', () => {
  const out = ordenarCatalogo(CATALOGO, 'name_asc');
  assert.deepEqual(out.map((p) => p.nombre), ['café Cauca', 'Café Huila', 'Café Nariño']);
});

test('name_desc: alfabético inverso', () => {
  const out = ordenarCatalogo(CATALOGO, 'name_desc');
  assert.deepEqual(out.map((p) => p.nombre), ['Café Nariño', 'Café Huila', 'café Cauca']);
});

test('bestseller: los bestseller=true primero, ESTABLE dentro de cada grupo (conserva el orden de entrada)', () => {
  const lista = [
    { nombre: 'A', precio: 1, bestseller: false },
    { nombre: 'B', precio: 2, bestseller: true },
    { nombre: 'C', precio: 3, bestseller: false },
    { nombre: 'D', precio: 4, bestseller: true },
  ];
  const out = ordenarCatalogo(lista, 'bestseller');
  assert.deepEqual(out.map((p) => p.nombre), ['B', 'D', 'A', 'C']);
});

test('bestseller: ausente (undefined) cuenta como false, no rompe el orden', () => {
  const lista = [
    { nombre: 'A', precio: 1 },
    { nombre: 'B', precio: 2, bestseller: true },
  ];
  const out = ordenarCatalogo(lista, 'bestseller');
  assert.deepEqual(out.map((p) => p.nombre), ['B', 'A']);
});

// ─── contarDisponibilidad ─────────────────────────────────────────────────────────────────────

test('contarDisponibilidad: cuenta disponibles y agotados', () => {
  const out = contarDisponibilidad([
    { disponible: true },
    { disponible: true },
    { disponible: false },
  ]);
  assert.deepEqual(out, { disponible: 2, agotado: 1 });
});

test('contarDisponibilidad: `disponible` AUSENTE cuenta como disponible (default seguro)', () => {
  const out = contarDisponibilidad([{}, { disponible: false }]);
  assert.deepEqual(out, { disponible: 1, agotado: 1 });
});

test('contarDisponibilidad: catálogo vacío da ceros', () => {
  assert.deepEqual(contarDisponibilidad([]), { disponible: 0, agotado: 0 });
});

// ─── rangoPrecioCatalogo ──────────────────────────────────────────────────────────────────────

test('rangoPrecioCatalogo: min/max del catálogo', () => {
  const out = rangoPrecioCatalogo([{ precio: 45000 }, { precio: 20000 }, { precio: 30000 }]);
  assert.deepEqual(out, { min: 20000, max: 45000 });
});

test('rangoPrecioCatalogo: un solo producto → min === max', () => {
  const out = rangoPrecioCatalogo([{ precio: 30000 }]);
  assert.deepEqual(out, { min: 30000, max: 30000 });
});

test('rangoPrecioCatalogo: catálogo VACÍO → {min:0, max:0} DECLARADO, no Infinity', () => {
  const out = rangoPrecioCatalogo([]);
  assert.deepEqual(out, { min: 0, max: 0 });
});

// ─── filtrarCatalogo ──────────────────────────────────────────────────────────────────────────

const SIN_FILTRO = {
  busqueda: '',
  categoria: 'all',
  tostado: 'all',
  disponibilidad: new Set<DisponibilidadFiltro>(),
  precioMin: -Infinity,
  precioMax: Infinity,
};

const PRODUCTOS = [
  { nombre: 'Café Nariño', origen: 'Nariño', categoria: 'Café en Grano', tostado: 'medio', precio: 30000, disponible: true },
  { nombre: 'Café Huila', origen: 'Huila', categoria: 'Café Molido', tostado: 'oscuro', precio: 45000, disponible: false },
  { nombre: 'Especial Cauca', origen: 'Cauca', categoria: 'Café en Grano', tostado: 'ligero', precio: 20000, disponible: true },
];

test('filtrarCatalogo: sin filtros (todo "all"/vacío/rango completo) devuelve todo, sin mutar', () => {
  const out = filtrarCatalogo(PRODUCTOS, SIN_FILTRO);
  assert.equal(out.length, 3);
  assert.deepEqual(out, PRODUCTOS);
});

test('filtrarCatalogo: búsqueda matchea por NOMBRE, insensible a mayúsculas, con espacios extra', () => {
  const out = filtrarCatalogo(PRODUCTOS, { ...SIN_FILTRO, busqueda: '  NARIÑO  ' });
  assert.deepEqual(out.map((p) => p.nombre), ['Café Nariño']);
});

test('filtrarCatalogo: búsqueda matchea por ORIGEN cuando no matchea el nombre', () => {
  const out = filtrarCatalogo(PRODUCTOS, { ...SIN_FILTRO, busqueda: 'huila' });
  assert.deepEqual(out.map((p) => p.nombre), ['Café Huila']);
});

test('filtrarCatalogo: categoría distinta de "all" filtra exacto', () => {
  const out = filtrarCatalogo(PRODUCTOS, { ...SIN_FILTRO, categoria: 'Café Molido' });
  assert.deepEqual(out.map((p) => p.nombre), ['Café Huila']);
});

test('filtrarCatalogo: tostado distinto de "all" filtra exacto', () => {
  const out = filtrarCatalogo(PRODUCTOS, { ...SIN_FILTRO, tostado: 'ligero' });
  assert.deepEqual(out.map((p) => p.nombre), ['Especial Cauca']);
});

test('filtrarCatalogo: disponibilidad con un solo estado seleccionado', () => {
  const out = filtrarCatalogo(PRODUCTOS, {
    ...SIN_FILTRO,
    disponibilidad: new Set<DisponibilidadFiltro>(['agotado']),
  });
  assert.deepEqual(out.map((p) => p.nombre), ['Café Huila']);
});

test('filtrarCatalogo: disponibilidad con LOS DOS estados seleccionados equivale a sin filtro', () => {
  const out = filtrarCatalogo(PRODUCTOS, {
    ...SIN_FILTRO,
    disponibilidad: new Set<DisponibilidadFiltro>(['agotado', 'disponible']),
  });
  assert.equal(out.length, 3);
});

test('filtrarCatalogo: rango de precio acota por ambos bordes (inclusivo)', () => {
  const out = filtrarCatalogo(PRODUCTOS, { ...SIN_FILTRO, precioMin: 25000, precioMax: 40000 });
  assert.deepEqual(out.map((p) => p.nombre), ['Café Nariño']);
});

test('filtrarCatalogo: precioMin/precioMax en los bordes exactos incluyen el producto (inclusivo, no exclusivo)', () => {
  const out = filtrarCatalogo(PRODUCTOS, { ...SIN_FILTRO, precioMin: 30000, precioMax: 30000 });
  assert.deepEqual(out.map((p) => p.nombre), ['Café Nariño']);
});

test('filtrarCatalogo: los ejes se COMBINAN (AND), no se evalúan aislados', () => {
  const out = filtrarCatalogo(PRODUCTOS, {
    ...SIN_FILTRO,
    categoria: 'Café en Grano',
    disponibilidad: new Set<DisponibilidadFiltro>(['disponible']),
    precioMax: 25000,
  });
  assert.deepEqual(out.map((p) => p.nombre), ['Especial Cauca']);
});

test('filtrarCatalogo: sin resultados → array vacío, no undefined/null', () => {
  const out = filtrarCatalogo(PRODUCTOS, { ...SIN_FILTRO, busqueda: 'no-existe-ningun-producto-asi' });
  assert.deepEqual(out, []);
});

// El tipo se ejercita para que un cambio de forma en `OrdenCatalogo` obligue a tocar este archivo.
test('fixture: OrdenCatalogo cubre exactamente los valores de OPCIONES_ORDEN (sin divergir)', () => {
  const esperado: OrdenCatalogo[] = ['featured', 'bestseller', 'name_asc', 'name_desc', 'price_asc', 'price_desc'];
  assert.deepEqual(OPCIONES_ORDEN.map((o) => o.value), esperado);
});
