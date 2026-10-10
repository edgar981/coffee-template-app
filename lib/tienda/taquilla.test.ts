import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivarMatrizTaquilla, nombreBaseProducto, celdaDe, MAX_VALORES_POR_EJE } from './taquilla';
import { decidirMolienda, agregableDirecto } from '@duna/core/moliendas-opciones';
import type { Product } from '@/types/product';

// EL CATÁLOGO REAL DE ONIX (§ TIENDA-COMPOSICIONES-CENSO-1, `.scratch/refero-paginas/catalogo-onix.json`,
// bajado de GET /api/catalog el 2026-10-10) — recortado a los campos que `derivarMatrizTaquilla`/
// `decidirMolienda` leen. Fixture propio, no una lectura en vivo de `.scratch/` (gitignored, no
// reproducible fuera de esta sesión).
function onix(over: Partial<Product>[] = []): Product[] {
  const base: Product[] = [
    { id: 'p-grano-500', nombre: 'Café Onix — En grano 500 g', slug: 'onix-grano-500', categoria: 'Café en Grano', precio: 35000, costo: 0, sku: null, stock: 10, activo: true, peso_gramos: 500, disponible: true, moliendasOpciones: [{ metodo: '', nombre: 'Grano entero', disponible: true }], descripcion: '' },
    { id: 'p-molido-500', nombre: 'Café Onix — Molido 500 g', slug: 'onix-molido-500', categoria: 'Café Molido', precio: 35000, costo: 0, sku: null, stock: 10, activo: true, peso_gramos: 500, disponible: true, moliendasOpciones: [], descripcion: '' },
    { id: 'p-molido-250', nombre: 'Café Onix — Molido 250 g', slug: 'onix-molido-250', categoria: 'Café Molido', precio: 20000, costo: 0, sku: null, stock: 10, activo: true, peso_gramos: 250, disponible: true, moliendasOpciones: [], descripcion: '' },
    { id: 'p-grano-250', nombre: 'Café Onix — En grano 250 g', slug: 'onix-grano-250', categoria: 'Café en Grano', precio: 20000, costo: 0, sku: null, stock: 10, activo: true, peso_gramos: 250, disponible: true, moliendasOpciones: [], descripcion: '' },
  ];
  return base.map((p, i) => ({ ...p, ...over[i] }));
}

test('derivarMatrizTaquilla: el catálogo real de Onix (2 categorías × 2 pesos) da una matriz COMPLETA', () => {
  const m = derivarMatrizTaquilla(onix());
  assert.ok(m);
  assert.deepEqual(m!.filas, ['Café en Grano', 'Café Molido']); // alfabético es-CO
  assert.deepEqual(m!.columnas, [250, 500]); // ascendente
  assert.equal(m!.celdas.size, 4);
  assert.equal(m!.celdas.get(celdaDe('Café en Grano', 500))!.id, 'p-grano-500');
  assert.equal(m!.celdas.get(celdaDe('Café Molido', 250))!.id, 'p-molido-250');
});

test('derivarMatrizTaquilla: un solo producto cae a Actual (null)', () => {
  assert.equal(derivarMatrizTaquilla(onix().slice(0, 1)), null);
});

test('derivarMatrizTaquilla: catálogo vacío cae a Actual (null)', () => {
  assert.equal(derivarMatrizTaquilla([]), null);
});

test('derivarMatrizTaquilla: un HUECO (falta una combinación) cae a Actual (null)', () => {
  // 3 productos, pero 2 categorías × 2 pesos = 4 celdas posibles — falta una.
  assert.equal(derivarMatrizTaquilla(onix().slice(0, 3)), null);
});

test('derivarMatrizTaquilla: un DUPLICADO (dos productos en la misma celda) cae a Actual (null)', () => {
  const dup = onix();
  dup[1] = { ...dup[1], categoria: dup[0].categoria, peso_gramos: dup[0].peso_gramos }; // choca con dup[0]
  assert.equal(derivarMatrizTaquilla(dup), null);
});

test('derivarMatrizTaquilla: más de 3 valores en un eje cae a Actual (null)', () => {
  const catalogo: Product[] = [];
  for (let i = 0; i <= MAX_VALORES_POR_EJE; i++) {
    catalogo.push({
      id: `p-${i}`, nombre: `Café — Molido ${i}00 g`, slug: `p-${i}`, categoria: 'Café Molido',
      precio: 10000, costo: 0, sku: null, stock: 5, activo: true, peso_gramos: 100 * (i + 1),
      disponible: true, moliendasOpciones: [], descripcion: '',
    });
  }
  assert.equal(catalogo.length, MAX_VALORES_POR_EJE + 1);
  assert.equal(derivarMatrizTaquilla(catalogo), null);
});

test('derivarMatrizTaquilla: un producto SIN categoría o SIN peso_gramos cae a Actual (null)', () => {
  const sinPeso = onix();
  sinPeso[0] = { ...sinPeso[0], peso_gramos: undefined };
  assert.equal(derivarMatrizTaquilla(sinPeso), null);

  const sinCategoria = onix();
  sinCategoria[0] = { ...sinCategoria[0], categoria: '' };
  assert.equal(derivarMatrizTaquilla(sinCategoria), null);
});

test('nombreBaseProducto: corta en " — ", nunca el nombre entero si no hay raya', () => {
  assert.equal(nombreBaseProducto('Café Onix — En grano 500 g'), 'Café Onix');
  assert.equal(nombreBaseProducto('Café Onix — Molido 250 g'), 'Café Onix');
  assert.equal(nombreBaseProducto('Sin raya'), 'Sin raya');
});

// ─── LA DECISIÓN DE MOLIENDA POR CELDA (§ TIENDA-COMPOSICIONES-CENSO-1, el riesgo de dinero) ──────
// La Taquilla NO puede reimplementar `addItem(producto, 1)` a secas: `moliendaAceptada` rechaza en
// el checkout un producto que declara opciones si llega sin molienda. Cada celda tiene que pasar por
// `decidirMolienda`/`agregableDirecto`, igual que `ProductCard.handleAdd`.

test('decidirMolienda por celda: el producto con UNA opción declarada decide "automatica" y es agregable directo', () => {
  const grano500 = onix()[0];
  const decision = decidirMolienda(grano500.moliendasOpciones);
  assert.deepEqual(decision, { modo: 'automatica', nombre: 'Grano entero' });
  assert.equal(agregableDirecto(grano500.moliendasOpciones), true);
});

test('decidirMolienda por celda: los tres productos SIN opciones declaradas deciden "ninguna" y son agregables directo', () => {
  for (const p of onix().slice(1)) {
    assert.deepEqual(decidirMolienda(p.moliendasOpciones), { modo: 'ninguna' });
    assert.equal(agregableDirecto(p.moliendasOpciones), true);
  }
});

test('decidirMolienda por celda: VARIAS opciones disponibles decide "eleccion" — NO agregable directo (manda a la ficha)', () => {
  const variasOpciones = [
    { metodo: 'Prensa francesa', nombre: 'Media', disponible: true },
    { metodo: 'V60', nombre: 'Fina', disponible: true },
  ];
  assert.deepEqual(decidirMolienda(variasOpciones), { modo: 'eleccion' });
  assert.equal(agregableDirecto(variasOpciones), false);
});
