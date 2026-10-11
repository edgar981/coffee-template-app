import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorLaminaProducto, laminasRelacionadas, fraseNotas, datosProductoLamina, colorPuntoNota } from './producto-lamina';
import { colorDeLamina } from './laminas';
import { tiendaInterludioVisible } from './tienda-cierre';
import type { Product } from '@/types/product';

const producto = (over: Partial<Product>): Product => ({
  id: over.id ?? 'p1',
  nombre: over.nombre ?? 'Pacamara',
  slug: over.slug ?? 'pacamara',
  categoria: 'Café',
  precio: 48000,
  costo: 0,
  sku: null,
  stock: 10,
  activo: true,
  descripcion: '',
  disponible: true,
  ...over,
});

const CATALOGO: Product[] = [
  producto({ id: 'a', slug: 'bourbon-rosado', nombre: 'Bourbon Rosado' }),
  producto({ id: 'b', slug: 'pacamara', nombre: 'Pacamara' }),
  producto({ id: 'c', slug: 'papayo', nombre: 'Papayo' }),
];

// ── el color sale del MISMO mapa que Láminas ──────────────────────────────────────────────────────
test('colorLaminaProducto: el color del producto es el mismo que daría colorDeLamina para su índice en el catálogo', () => {
  const mapa = { b: '#112233' };
  assert.equal(colorLaminaProducto(CATALOGO, 'b', mapa), colorDeLamina('b', 1, mapa));
});

test('colorLaminaProducto: sin entrada en el mapa, cae a la misma paleta de reserva que Láminas (mismo índice)', () => {
  assert.equal(colorLaminaProducto(CATALOGO, 'c', {}), colorDeLamina('c', 2, {}));
});

test('colorLaminaProducto: producto ausente del catálogo recibido cae al índice 0, no lanza', () => {
  assert.equal(colorLaminaProducto(CATALOGO, 'inexistente', {}), colorDeLamina('inexistente', 0, {}));
});

// ── «Te puede interesar» excluye el producto actual ───────────────────────────────────────────────
test('laminasRelacionadas: excluye el producto actual, conserva los demás con el color de SU índice real', () => {
  const relacionados = laminasRelacionadas(CATALOGO, 'b', {});
  assert.deepEqual(relacionados.map((r) => r.productId), ['a', 'c']);
  assert.equal(relacionados[0].color, colorDeLamina('a', 0, {}));
  assert.equal(relacionados[1].color, colorDeLamina('c', 2, {}));
});

test('laminasRelacionadas: catálogo de un solo producto (el actual) → lista vacía', () => {
  assert.deepEqual(laminasRelacionadas([producto({ id: 'solo' })], 'solo', {}), []);
});

test('laminasRelacionadas: conserva TODAS las notas (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 7 — la maqueta muestra la frase completa, no un recorte a dos)', () => {
  const [relacionado] = laminasRelacionadas(
    [producto({ id: 'x', notas: ['Chocolate', 'Floral', 'Cítrico'] }), producto({ id: 'actual' })],
    'actual',
    {},
  );
  assert.deepEqual(relacionado.notas, ['Chocolate', 'Floral', 'Cítrico']);
});

// ── sin retrato no hay bloque — reuso del MISMO gate que /tienda, no uno nuevo ────────────────────
test('sin retrato no hay bloque: el gate que decide si el Interludio se muestra es el MISMO de /tienda (tiendaInterludioVisible), reusado tal cual', () => {
  assert.equal(tiendaInterludioVisible(''), false);
  assert.equal(tiendaInterludioVisible('   '), false);
  assert.equal(tiendaInterludioVisible('https://blob.example/retrato.jpg'), true);
});

// ── la frase de notas ──────────────────────────────────────────────────────────────────────────────
test('fraseNotas: sin notas, cadena vacía', () => {
  assert.equal(fraseNotas([]), '');
});

test('fraseNotas: una nota → "A."', () => {
  assert.equal(fraseNotas(['Chocolate']), 'Chocolate.');
});

test('fraseNotas: dos notas → "A y B."', () => {
  assert.equal(fraseNotas(['Chocolate', 'Tropical']), 'Chocolate y Tropical.');
});

test('fraseNotas: tres notas → "A, B y C." (la maqueta aprobada, "Chocolate, tropical y cremoso.")', () => {
  assert.equal(fraseNotas(['Chocolate', 'Tropical', 'Cremoso']), 'Chocolate, Tropical y Cremoso.');
});

test('fraseNotas: descarta vacíos/espacios antes de puntuar', () => {
  assert.equal(fraseNotas(['Chocolate', '  ', 'Tropical']), 'Chocolate y Tropical.');
});

// ── los datos del producto, sólo los que existen ──────────────────────────────────────────────────
test('datosProductoLamina: sin ningún dato, lista vacía (la etiqueta no se muestra)', () => {
  assert.deepEqual(datosProductoLamina({}), []);
});

test('datosProductoLamina: con los cuatro, en orden variedad · altitud · tostión · peso', () => {
  assert.deepEqual(
    datosProductoLamina({ variedad: 'Pacamara', altitudMin: 1600, altitudMax: 2000, tostado: 'medio', peso_gramos: 340 }),
    [
      { label: 'Variedad', value: 'Pacamara' },
      { label: 'Altitud', value: '1.600–2.000 m s.n.m.' },
      { label: 'Tostión', value: 'Media' },
      { label: 'Peso', value: '340 g' },
    ],
  );
});

test('datosProductoLamina: altitud con un solo extremo (sin el otro) se omite entera', () => {
  assert.deepEqual(datosProductoLamina({ altitudMin: 1600 }), []);
  assert.deepEqual(datosProductoLamina({ altitudMax: 2000 }), []);
});

test('datosProductoLamina: tostado fuera del set conocido (catálogo no-café) se omite, no "Tostión: undefined"', () => {
  assert.deepEqual(datosProductoLamina({ tostado: 'inventado' as never }), []);
});

test('datosProductoLamina: sólo variedad presente → sólo esa entrada', () => {
  assert.deepEqual(datosProductoLamina({ variedad: 'Caturra' }), [{ label: 'Variedad', value: 'Caturra' }]);
});

// ── el punto FUERTE de las notas (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 1) ──────────────────
test('colorPuntoNota: un pastel casi blanco (el color de lámina del Bourbon Rosado de la maqueta) se vuelve sólido y saturado, no un derivado hueco', () => {
  assert.equal(colorPuntoNota('#F8D9D1'), '#ba3d1c');
});

test('colorPuntoNota: un color de lámina ya oscuro/saturado (acento por defecto de Nayoli) también se lleva al mismo piso de fuerza, nunca se queda igual', () => {
  const fuerte = colorPuntoNota('#8b4513');
  assert.equal(fuerte, '#bc5e1a');
  assert.notEqual(fuerte, '#8b4513');
});

test('colorPuntoNota: nunca devuelve el mismo color que recibió — el punto SIEMPRE se distingue de la lámina', () => {
  for (const c of ['#F8D9D1', '#8b4513', '#592e10', '#c9a88e', '#bb9172']) {
    assert.notEqual(colorPuntoNota(c), c);
  }
});

test('colorPuntoNota: un color acromático (gris/blanco/negro) no revienta — cae a un rojo determinista, nunca NaN/undefined', () => {
  for (const c of ['#000000', '#ffffff', '#808080']) {
    const fuerte = colorPuntoNota(c);
    assert.match(fuerte, /^#[0-9a-f]{6}$/);
  }
});
