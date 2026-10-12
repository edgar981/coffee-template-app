import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  precioPor100Gramos,
  etiquetaEje1,
  etiquetaEje2,
  captionSeleccion,
  iconoDeOpcion,
  ayudaParaFila,
  filaDatoVisible,
  filasDeDatosVisibles,
  debeCaerAComposicionPorDefecto,
  opcionesEje1,
  opcionesEje2,
} from './compra-home';
import { derivarMatrizTaquilla } from '@/lib/tienda/taquilla';
import type { Product } from '@/types/product';

// EL CATÁLOGO REAL DE NAYOLI (prisma/seed-products.ts, recortado a los campos que
// `derivarMatrizTaquilla` lee) — 2 categorías (Café en Grano / Café Molido) × 2 pesos (250/500 g).
function nayoli(over: Partial<Product>[] = []): Product[] {
  const base: Product[] = [
    { id: 'nayoli-250g-grano', nombre: 'Café Nayoli — En grano 250 g', slug: 'cafe-nayoli-grano-250g', categoria: 'Café en Grano', precio: 20000, costo: 14000, sku: null, stock: 42, activo: true, peso_gramos: 250, disponible: true, moliendasOpciones: [], descripcion: '' },
    { id: 'nayoli-250g-molido', nombre: 'Café Nayoli — Molido 250 g', slug: 'cafe-nayoli-molido-250g', categoria: 'Café Molido', precio: 20000, costo: 14000, sku: null, stock: 42, activo: true, peso_gramos: 250, disponible: true, moliendasOpciones: [], descripcion: '' },
    { id: 'nayoli-500g-grano', nombre: 'Café Nayoli — En grano 500 g', slug: 'cafe-nayoli-grano-500g', categoria: 'Café en Grano', precio: 35000, costo: 24000, sku: null, stock: 28, activo: true, peso_gramos: 500, disponible: true, moliendasOpciones: [], descripcion: '' },
    { id: 'nayoli-500g-molido', nombre: 'Café Nayoli — Molido 500 g', slug: 'cafe-nayoli-molido-500g', categoria: 'Café Molido', precio: 35000, costo: 24000, sku: null, stock: 28, activo: true, peso_gramos: 500, disponible: true, moliendasOpciones: [], descripcion: '' },
  ];
  return base.map((p, i) => ({ ...p, ...over[i] }));
}

// ── precioPor100Gramos ───────────────────────────────────────────────────────────────────────────

test('precioPor100Gramos: 250 g a $20.000 → $8.000', () => {
  assert.equal(precioPor100Gramos(20000, 250), 8000);
});

test('precioPor100Gramos: 500 g a $35.000 → $7.000', () => {
  assert.equal(precioPor100Gramos(35000, 500), 7000);
});

test('precioPor100Gramos: peso ausente/0/negativo da 0, nunca NaN/Infinity', () => {
  assert.equal(precioPor100Gramos(20000, 0), 0);
  assert.equal(precioPor100Gramos(20000, -10), 0);
  assert.equal(precioPor100Gramos(20000, Number.NaN), 0);
});

// ── etiquetas de opciones (misma regla que la Taquilla de /tienda) ─────────────────────────────────

test('etiquetaEje1: el LITERAL de la categoría, sin transformar', () => {
  assert.equal(etiquetaEje1('Café en Grano'), 'Café en Grano');
  assert.equal(etiquetaEje1('Café Molido'), 'Café Molido');
});

test('etiquetaEje2: "{peso} g"', () => {
  assert.equal(etiquetaEje2(250), '250 g');
  assert.equal(etiquetaEje2(500), '500 g');
});

test('captionSeleccion: "{peso} g · {categoria}", en ese orden', () => {
  assert.equal(captionSeleccion(250, 'Café en Grano'), '250 g · Café en Grano');
  assert.equal(captionSeleccion(500, 'Café Molido'), '500 g · Café Molido');
});

// ── ícono por opción ─────────────────────────────────────────────────────────────────────────────

test('iconoDeOpcion: "grano"/"molido" se reconocen; cualquier otra cosa es "sin ícono"', () => {
  assert.equal(iconoDeOpcion('grano'), 'grano');
  assert.equal(iconoDeOpcion('molido'), 'molido');
  assert.equal(iconoDeOpcion('ninguno'), null);
  assert.equal(iconoDeOpcion(''), null);
  assert.equal(iconoDeOpcion(undefined), null);
  assert.equal(iconoDeOpcion('GRANO'), null); // sin normalizar mayúsculas — set cerrado exacto
});

// ── ayuda por opción (posicional, en el orden de la matriz) ────────────────────────────────────────

test('ayudaParaFila: devuelve la ayuda de SU índice, nunca la de otra fila', () => {
  const ayudas = ['Para moler en casa, justo antes de preparar.', 'Molienda media: para prensa francesa, filtro V60 o greca.'];
  assert.equal(ayudaParaFila(ayudas, 0), 'Para moler en casa, justo antes de preparar.');
  assert.equal(ayudaParaFila(ayudas, 1), 'Molienda media: para prensa francesa, filtro V60 o greca.');
});

test('ayudaParaFila: una fila sin su propia ayuda no hereda la de otra ni corre las demás', () => {
  const ayudas = ['', 'la del medio', undefined];
  assert.equal(ayudaParaFila(ayudas, 0), undefined);
  assert.equal(ayudaParaFila(ayudas, 1), 'la del medio');
  assert.equal(ayudaParaFila(ayudas, 2), undefined);
});

// ── filas de datos (0 a 3, vacía no se muestra) ─────────────────────────────────────────────────────

test('filaDatoVisible: requiere rótulo Y valor — uno solo no alcanza', () => {
  assert.equal(filaDatoVisible('Envío', 'A todo el país'), true);
  assert.equal(filaDatoVisible('Envío', ''), false);
  assert.equal(filaDatoVisible('', 'A todo el país'), false);
  assert.equal(filaDatoVisible(undefined, undefined), false);
  assert.equal(filaDatoVisible('  ', '  '), false); // sólo espacios no cuenta como presente
});

test('filasDeDatosVisibles: filtra las incompletas, conserva el orden de las completas', () => {
  const filas = filasDeDatosVisibles([
    { rotulo: 'Envío', valor: 'A todo el país' },
    { rotulo: 'Tostión', valor: '' }, // incompleta — no cuenta
    { rotulo: 'Origen', valor: 'Supatá' },
  ]);
  assert.deepEqual(filas, [
    { rotulo: 'Envío', valor: 'A todo el país' },
    { rotulo: 'Origen', valor: 'Supatá' },
  ]);
});

test('filasDeDatosVisibles: las 3 vacías → []', () => {
  assert.deepEqual(filasDeDatosVisibles([{}, {}, {}]), []);
});

// ── caída sin matriz válida ──────────────────────────────────────────────────────────────────────

test('debeCaerAComposicionPorDefecto: el catálogo real de Nayoli (2×2 completa) NO cae', () => {
  assert.equal(debeCaerAComposicionPorDefecto(nayoli()), false);
});

test('debeCaerAComposicionPorDefecto: un solo producto SÍ cae (menos de 2)', () => {
  assert.equal(debeCaerAComposicionPorDefecto(nayoli().slice(0, 1)), true);
});

test('debeCaerAComposicionPorDefecto: catálogo vacío SÍ cae', () => {
  assert.equal(debeCaerAComposicionPorDefecto([]), true);
});

test('debeCaerAComposicionPorDefecto: un HUECO (falta una combinación) SÍ cae', () => {
  assert.equal(debeCaerAComposicionPorDefecto(nayoli().slice(0, 3)), true);
});

test('debeCaerAComposicionPorDefecto: coincide con derivarMatrizTaquilla !== null (misma pregunta)', () => {
  const catalogo = nayoli();
  assert.equal(debeCaerAComposicionPorDefecto(catalogo), derivarMatrizTaquilla(catalogo) === null);
});

// ── agotado no elegible (cruzado contra el eje activo) ──────────────────────────────────────────────

test('opcionesEje1: agotada = el cruce (categoría, peso activo) sin stock — las demás quedan elegibles', () => {
  const catalogo = nayoli([{}, {}, { disponible: false }]); // "Café en Grano" 500 g agotado
  const matriz = derivarMatrizTaquilla(catalogo)!;
  const opciones = opcionesEje1(matriz, 500);
  assert.deepEqual(opciones, [
    { categoria: 'Café en Grano', agotada: true },
    { categoria: 'Café Molido', agotada: false },
  ]);
  // El MISMO eje, cruzado contra 250 g, no ve ese agotado — es específico de la celda.
  assert.deepEqual(opcionesEje1(matriz, 250), [
    { categoria: 'Café en Grano', agotada: false },
    { categoria: 'Café Molido', agotada: false },
  ]);
});

test('opcionesEje2: agotada = el cruce (categoría activa, peso) sin stock, con su precio', () => {
  const catalogo = nayoli([{ disponible: false }]); // "Café en Grano" 250 g agotado
  const matriz = derivarMatrizTaquilla(catalogo)!;
  assert.deepEqual(opcionesEje2(matriz, 'Café en Grano'), [
    { peso: 250, precio: 20000, agotada: true },
    { peso: 500, precio: 35000, agotada: false },
  ]);
  assert.deepEqual(opcionesEje2(matriz, 'Café Molido'), [
    { peso: 250, precio: 20000, agotada: false },
    { peso: 500, precio: 35000, agotada: false },
  ]);
});
