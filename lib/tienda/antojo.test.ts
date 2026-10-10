import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Product } from '@/types/product';
import { mostrarSelectorAntojo, pildorasAntojo, MAX_PRODUCTOS_SELECTOR_ANTOJO } from './antojo';

function producto(p: Pick<Product, 'id' | 'slug' | 'nombre'> & Partial<Product>): Product {
  return {
    categoria: 'Café de especialidad', precio: 0, costo: 0, sku: null, stock: 10, activo: true,
    descripcion: '', ...p,
  };
}

// Catálogo REAL de Las Chamisas (§ .scratch/refero-paginas/catalogo-chamisas.json, citado por el
// spec) — 3 productos, notas poblada en los tres.
const CHAMISAS: Product[] = [
  producto({ id: 'cmuq16fgj0000kwr1tpf89epi', slug: 'bourbon-rosado', nombre: 'Bourbon Rosado', notas: ['Floral', 'Frutos rojos', 'Dulce'] }),
  producto({ id: 'cmuq16g4o0002kwr109cpepk9', slug: 'pacamara', nombre: 'Pacamara', notas: ['Chocolate', 'Tropical', 'Cremoso'] }),
  producto({ id: 'cmuq16gqz0004kwr1qshskbmt', slug: 'papayo', nombre: 'Papayo', notas: ['Caramelo', 'Cítrico', 'Balanceado'] }),
];

// ─── EL UMBRAL: 6 productos o menos → selector; más → filtros de «Actual» ─────────────────────────

test('mostrarSelectorAntojo: con el catálogo de Las Chamisas (3) el selector SÍ se muestra', () => {
  assert.equal(mostrarSelectorAntojo(CHAMISAS), true);
});

test(`mostrarSelectorAntojo: con exactamente ${MAX_PRODUCTOS_SELECTOR_ANTOJO} productos el selector SÍ se muestra (el borde)`, () => {
  const seis = Array.from({ length: MAX_PRODUCTOS_SELECTOR_ANTOJO }, (_, i) =>
    producto({ id: `p${i}`, slug: `p${i}`, nombre: `Producto ${i}` }));
  assert.equal(mostrarSelectorAntojo(seis), true);
});

test(`mostrarSelectorAntojo: con ${MAX_PRODUCTOS_SELECTOR_ANTOJO + 1} productos el selector NO se muestra — quedan los filtros de «Actual»`, () => {
  const siete = Array.from({ length: MAX_PRODUCTOS_SELECTOR_ANTOJO + 1 }, (_, i) =>
    producto({ id: `p${i}`, slug: `p${i}`, nombre: `Producto ${i}` }));
  assert.equal(mostrarSelectorAntojo(siete), false);
});

test('mostrarSelectorAntojo: un catálogo vacío tampoco muestra el selector', () => {
  assert.equal(mostrarSelectorAntojo([]), false);
});

// ─── LAS PÍLDORAS: salen de `notas`, dos como máximo, con el color de la lámina ────────────────────

test('pildorasAntojo: una píldora por café, con sus DOS primeras notas (catálogo real de Las Chamisas)', () => {
  const pildoras = pildorasAntojo(CHAMISAS, {});
  assert.equal(pildoras.length, 3);
  assert.deepEqual(pildoras[0].notas, ['Floral', 'Frutos rojos']);
  assert.deepEqual(pildoras[1].notas, ['Chocolate', 'Tropical']);
  assert.deepEqual(pildoras[2].notas, ['Caramelo', 'Cítrico']);
  assert.equal(pildoras[0].nombre, 'Bourbon Rosado');
  assert.equal(pildoras[0].slug, 'bourbon-rosado');
});

test('pildorasAntojo: un producto sin `notas` da una píldora con lista vacía, no revienta', () => {
  const sinNotas = [producto({ id: 'p1', slug: 'p1', nombre: 'Sin notas' })];
  const pildoras = pildorasAntojo(sinNotas, {});
  assert.deepEqual(pildoras[0].notas, []);
});

test('pildorasAntojo: el color de cada píldora es EXACTAMENTE el de su lámina (misma fuente, § colorDeLamina)', () => {
  const coloresPorProducto = { [CHAMISAS[1].id]: '#ff00aa' };
  const pildoras = pildorasAntojo(CHAMISAS, coloresPorProducto);
  assert.equal(pildoras[1].color, '#ff00aa');
  // El primero y el tercero no tienen color elegido: deben coincidir entre sí y con el resto del
  // catálogo bajo el mismo criterio de "por orden" (no se repiten entre índices distintos).
  assert.notEqual(pildoras[0].color, pildoras[2].color);
});
