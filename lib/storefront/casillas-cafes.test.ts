import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  derivarCasillasCafes,
  casillasCafesActivo,
  celdaCafeDe,
  productoDelCafe,
  productoDePeso,
} from './casillas-cafes';
import { derivarMatrizTaquilla } from '@/lib/tienda/taquilla';
import type { Product } from '@/types/product';

// § CHAMISAS-CASILLAS-POR-CAFE-1. EL CATÁLOGO REAL DE LAS CHAMISAS (medido contra GET
// /api/catalog de su despliegue el 2026-10-14, § el spec de este slice): tres cafés —Bourbon
// Rosado, Pacamara, Papayo—, los TRES bajo la MISMA categoría «Café de especialidad» y los TRES
// a 340 g. Ningún separador " — " en el nombre: el catálogo sólo declara un tamaño, así que el
// nombre completo YA ES el café.
function base() {
  return { costo: 0, sku: null, stock: 10, activo: true, disponible: true, descripcion: '' };
}

function chamisasReal(): Product[] {
  const conMolienda = [
    { nombre: 'En grano', metodo: 'Muele en casa', disponible: true },
    { nombre: 'Molido', metodo: 'Filtro', disponible: true },
  ];
  return [
    { ...base(), id: 'bourbon', nombre: 'Bourbon Rosado', slug: 'bourbon', categoria: 'Café de especialidad', precio: 52000, peso_gramos: 340, notas: ['Floral', 'Frutos rojos', 'Dulce'], moliendasOpciones: conMolienda },
    { ...base(), id: 'pacamara', nombre: 'Pacamara', slug: 'pacamara', categoria: 'Café de especialidad', precio: 48000, peso_gramos: 340, notas: ['Chocolate', 'Tropical'], moliendasOpciones: conMolienda },
    { ...base(), id: 'papayo', nombre: 'Papayo', slug: 'papayo', categoria: 'Café de especialidad', precio: 44000, peso_gramos: 340, notas: ['Caramelo', 'Cítrico'], moliendasOpciones: conMolienda },
  ] as Product[];
}

// ─── EL DEFECTO, REPRODUCIDO ANTES DE ARREGLARLO ───────────────────────────────────────────────

test('EL DEFECTO: el catálogo real de Las Chamisas hace que `derivarMatrizTaquilla` devuelva null (los tres productos reclaman la misma celda categoría×peso)', () => {
  assert.equal(derivarMatrizTaquilla(chamisasReal()), null);
});

test('EL FIX: el MISMO catálogo, bajo `derivarCasillasCafes`, da una matriz válida — 3 cafés × 1 peso', () => {
  const m = derivarCasillasCafes(chamisasReal());
  assert.ok(m, 'debe derivar una matriz válida — ya no cae a null');
  assert.deepEqual(m!.cafes, ['Bourbon Rosado', 'Pacamara', 'Papayo'], 'orden del catálogo, no alfabético');
  assert.deepEqual(m!.pesos, [340]);
  assert.equal(m!.celdas.size, 3);
  assert.equal(m!.celdas.get(celdaCafeDe('Bourbon Rosado', 340))!.id, 'bourbon');
  assert.equal(m!.celdas.get(celdaCafeDe('Pacamara', 340))!.id, 'pacamara');
  assert.equal(m!.celdas.get(celdaCafeDe('Papayo', 340))!.id, 'papayo');
});

test('casillasCafesActivo: true para el catálogo real de Las Chamisas (false bajo el criterio viejo de Taquilla)', () => {
  assert.equal(casillasCafesActivo(chamisasReal()), true);
  assert.equal(derivarMatrizTaquilla(chamisasReal()) !== null, false);
});

// ─── SPARSE: un café sin un tamaño dado queda DESHABILITADO, no invalida la composición ────────

function chamisasConUnCafeDeDosTamanos(): Product[] {
  const conMolienda = [{ nombre: 'En grano', metodo: 'x', disponible: true }];
  return [
    { ...base(), id: 'bourbon-340', nombre: 'Bourbon Rosado — 340 g', slug: 'bourbon-340', categoria: 'Café de especialidad', precio: 52000, peso_gramos: 340, moliendasOpciones: conMolienda, notas: [] },
    { ...base(), id: 'bourbon-500', nombre: 'Bourbon Rosado — 500 g', slug: 'bourbon-500', categoria: 'Café de especialidad', precio: 74000, peso_gramos: 500, moliendasOpciones: conMolienda, notas: [] },
    { ...base(), id: 'pacamara-340', nombre: 'Pacamara — 340 g', slug: 'pacamara-340', categoria: 'Café de especialidad', precio: 48000, peso_gramos: 340, moliendasOpciones: conMolienda, notas: [] },
    { ...base(), id: 'papayo-340', nombre: 'Papayo — 340 g', slug: 'papayo-340', categoria: 'Café de especialidad', precio: 44000, peso_gramos: 340, moliendasOpciones: conMolienda, notas: [] },
  ] as Product[];
}

test('derivarCasillasCafes: café con DOS tamaños + dos cafés con UNO solo — matriz SPARSE, 3 cafés × 2 pesos, 3 celdas de 6 posibles', () => {
  const m = derivarCasillasCafes(chamisasConUnCafeDeDosTamanos())!;
  assert.ok(m);
  assert.deepEqual(m.cafes, ['Bourbon Rosado', 'Pacamara', 'Papayo']);
  assert.deepEqual(m.pesos, [340, 500]);
  assert.equal(m.celdas.size, 4, 'Bourbon×340, Bourbon×500, Pacamara×340, Papayo×340 — Pacamara×500 y Papayo×500 NO existen');
  assert.ok(m.celdas.has(celdaCafeDe('Bourbon Rosado', 500)));
  assert.ok(!m.celdas.has(celdaCafeDe('Pacamara', 500)), 'Pacamara no tiene 500 g — la celda no existe, no invalida la matriz');
  assert.ok(!m.celdas.has(celdaCafeDe('Papayo', 500)));
});

// ─── EL UMBRAL DE INVALIDEZ: CERO cafés activos ────────────────────────────────────────────────

test('derivarCasillasCafes: catálogo vacío → null', () => {
  assert.equal(derivarCasillasCafes([]), null);
});

test('derivarCasillasCafes: todo el catálogo SIN peso_gramos → null (cero cafés activos)', () => {
  const sinPeso = chamisasReal().map((p) => ({ ...p, peso_gramos: undefined }));
  assert.equal(derivarCasillasCafes(sinPeso), null);
});

test('derivarCasillasCafes: UN SOLO café activo (los demás sin peso) → matriz válida con una fila — el piso es 1, no 2', () => {
  const [bourbon, pacamara, papayo] = chamisasReal();
  const catalogo = [bourbon, { ...pacamara, peso_gramos: undefined }, { ...papayo, peso_gramos: undefined }];
  const m = derivarCasillasCafes(catalogo)!;
  assert.ok(m, 'un solo café activo basta — "menos de un café activo" es el umbral, no "menos de dos"');
  assert.deepEqual(m.cafes, ['Bourbon Rosado']);
});

// ─── EL CAFÉ SE IDENTIFICA POR `nombreBaseProducto`, NO por `categoria` ────────────────────────

test('derivarCasillasCafes: dos cafés con la MISMA categoria siguen siendo DOS filas (el defecto que esto arregla)', () => {
  const m = derivarCasillasCafes(chamisasReal())!;
  assert.equal(new Set(chamisasReal().map((p) => p.categoria)).size, 1, 'precondición: los tres comparten categoría');
  assert.equal(m.cafes.length, 3, 'y aun así son tres filas — categoria no interviene en esta derivación');
});

test('derivarCasillasCafes: con el separador " — ", el café es el nombre ANTES de la raya (mismo recorte que Taquilla)', () => {
  const catalogo: Product[] = [
    { ...base(), id: 'a', nombre: 'Bourbon Rosado — En grano 340 g', slug: 'a', categoria: 'X', precio: 1, peso_gramos: 340, moliendasOpciones: [], notas: [] },
    { ...base(), id: 'b', nombre: 'Bourbon Rosado — Molido 340 g', slug: 'b', categoria: 'X', precio: 1, peso_gramos: 340, moliendasOpciones: [], notas: [] },
  ] as Product[];
  const m = derivarCasillasCafes(catalogo)!;
  // Mismo café (Bourbon Rosado), mismo peso (340): el SEGUNDO producto del catálogo gana la celda
  // — documentado como el caso de duplicado, no invalida la composición.
  assert.deepEqual(m.cafes, ['Bourbon Rosado']);
  assert.equal(m.celdas.get(celdaCafeDe('Bourbon Rosado', 340))!.id, 'b');
});

test('derivarCasillasCafes: sin raya, el nombre completo ES el café (el caso de Las Chamisas)', () => {
  const m = derivarCasillasCafes(chamisasReal())!;
  assert.ok(m.cafes.includes('Bourbon Rosado'));
  assert.ok(m.cafes.includes('Pacamara'));
  assert.ok(m.cafes.includes('Papayo'));
});

// ─── productoDelCafe / productoDePeso ──────────────────────────────────────────────────────────

test('productoDelCafe: con el peso preferido disponible, lo devuelve directo', () => {
  const m = derivarCasillasCafes(chamisasConUnCafeDeDosTamanos())!;
  assert.equal(productoDelCafe(m, 'Bourbon Rosado', 500).id, 'bourbon-500');
});

test('productoDelCafe: sin el peso preferido, cae al de MENOR peso disponible para ese café', () => {
  const m = derivarCasillasCafes(chamisasConUnCafeDeDosTamanos())!;
  // Pacamara no tiene 500 g — cae a su único producto, 340 g.
  assert.equal(productoDelCafe(m, 'Pacamara', 500).id, 'pacamara-340');
});

test('productoDePeso: el primer café (en orden de catálogo) que tenga ese peso', () => {
  const m = derivarCasillasCafes(chamisasConUnCafeDeDosTamanos())!;
  assert.equal(productoDePeso(m, 340).id, 'bourbon-340', 'Bourbon es el primer café, y tiene 340');
  assert.equal(productoDePeso(m, 500).id, 'bourbon-500', 'sólo Bourbon tiene 500 — único candidato');
});
