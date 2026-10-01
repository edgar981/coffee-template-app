import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ejesSpotlight,
  grupoSpotlight,
  valoresDeEje,
  productoDeCombinacion,
  etiquetaEjesSpotlight,
} from './spotlight';

// ─── ejesSpotlight — DATO del producto, nunca un literal inventado ────────────────────────────────

test('ejesSpotlight: `variante` = "<presentación> · <peso> g" se parte limpio por el sufijo exacto', () => {
  assert.deepEqual(
    ejesSpotlight({ slug: 'x', variante: 'En grano · 250 g', peso_gramos: 250 }),
    { presentacion: 'En grano', tamano: '250 g' },
  );
  assert.deepEqual(
    ejesSpotlight({ slug: 'x', variante: 'Molido · 500 g', peso_gramos: 500 }),
    { presentacion: 'Molido', tamano: '500 g' },
  );
});

test('ejesSpotlight: sin `peso_gramos`, un `variante` con separador genérico " · " igual se parte en dos', () => {
  assert.deepEqual(
    ejesSpotlight({ slug: 'x', variante: 'Decaf · 250 g' }),
    { presentacion: 'Decaf', tamano: null },
  );
});

test('ejesSpotlight: sin `variante` utilizable, cae a la ficha técnica `molienda` — con ella, "Molido"', () => {
  assert.deepEqual(
    ejesSpotlight({ slug: 'x', peso_gramos: 250, molienda: 'Media' }),
    { presentacion: 'Molido', tamano: '250 g' },
  );
});

test('ejesSpotlight: sin `variante` ni `molienda`, "En grano" — nunca una presentación vacía', () => {
  assert.deepEqual(
    ejesSpotlight({ slug: 'x', peso_gramos: 500 }),
    { presentacion: 'En grano', tamano: '500 g' },
  );
});

test('ejesSpotlight: `variante` vacío ("") se trata como ausente — cae a `molienda`/peso, no a una cadena vacía', () => {
  assert.deepEqual(
    ejesSpotlight({ slug: 'x', variante: '', peso_gramos: 250, molienda: 'Media' }),
    { presentacion: 'Molido', tamano: '250 g' },
  );
});

test('ejesSpotlight: sin `peso_gramos`, el tamaño es `null` — el único de los dos ejes sin fallback honesto', () => {
  assert.equal(ejesSpotlight({ slug: 'x', molienda: 'Media' }).tamano, null);
});

// ─── grupoSpotlight / valoresDeEje — la matriz, construida del grupo pineado ──────────────────────

const GRANO_500 = { slug: 'cafe-grano-500', variante: 'En grano · 500 g', peso_gramos: 500 };
const MOLIDO_500 = { slug: 'cafe-molido-500', variante: 'Molido · 500 g', peso_gramos: 500, molienda: 'Media' };
const GRANO_250 = { slug: 'cafe-grano-250', variante: 'En grano · 250 g', peso_gramos: 250 };
const MOLIDO_250 = { slug: 'cafe-molido-250', variante: 'Molido · 250 g', peso_gramos: 250, molienda: 'Media' };

test('valoresDeEje: los valores únicos del grupo completo, en el orden en que el grupo los trae', () => {
  const grupo = grupoSpotlight([GRANO_500, MOLIDO_500, GRANO_250, MOLIDO_250]);
  assert.deepEqual(valoresDeEje(grupo, 'presentacion'), ['En grano', 'Molido']);
  assert.deepEqual(valoresDeEje(grupo, 'tamano'), ['500 g', '250 g']);
});

test('valoresDeEje: un solo producto en el grupo — cada eje tiene un solo valor', () => {
  const grupo = grupoSpotlight([GRANO_500]);
  assert.deepEqual(valoresDeEje(grupo, 'presentacion'), ['En grano']);
  assert.deepEqual(valoresDeEje(grupo, 'tamano'), ['500 g']);
});

test('valoresDeEje: no duplica un valor que dos productos comparten', () => {
  const grupo = grupoSpotlight([GRANO_500, MOLIDO_500]); // los dos son "500 g"
  assert.deepEqual(valoresDeEje(grupo, 'tamano'), ['500 g']);
});

// ─── productoDeCombinacion — la celda de la matriz, o `null` si no existe (deshabilitado, no oculto) ──

test('productoDeCombinacion: la matriz 2×2 completa resuelve las CUATRO combinaciones a su producto exacto', () => {
  const grupo = grupoSpotlight([GRANO_500, MOLIDO_500, GRANO_250, MOLIDO_250]);
  assert.equal(productoDeCombinacion(grupo, 'En grano', '500 g'), GRANO_500);
  assert.equal(productoDeCombinacion(grupo, 'Molido', '500 g'), MOLIDO_500);
  assert.equal(productoDeCombinacion(grupo, 'En grano', '250 g'), GRANO_250);
  assert.equal(productoDeCombinacion(grupo, 'Molido', '250 g'), MOLIDO_250);
});

test('productoDeCombinacion: una celda sin producto en el grupo devuelve null — la "opción deshabilitada" del spec', () => {
  // Grupo con sólo TRES de las cuatro celdas (falta Molido·250 g) — el caso migrado de
  // presentacionSlug/otroTamanoSlug de antes de este slice, sin el cuarto puntero configurado.
  const grupo = grupoSpotlight([GRANO_500, MOLIDO_500, GRANO_250]);
  assert.equal(productoDeCombinacion(grupo, 'Molido', '250 g'), null);
  assert.equal(productoDeCombinacion(grupo, 'En grano', '250 g'), GRANO_250, 'las otras tres celdas SÍ resuelven');
});

test('productoDeCombinacion: grupo de un solo producto — sólo su propia combinación resuelve', () => {
  const grupo = grupoSpotlight([GRANO_500]);
  assert.equal(productoDeCombinacion(grupo, 'En grano', '500 g'), GRANO_500);
  assert.equal(productoDeCombinacion(grupo, 'Molido', '500 g'), null);
});

// ─── etiquetaEjesSpotlight — la etiqueta sobre la foto, SIEMPRE presentación + peso ───────────────

test('etiquetaEjesSpotlight: "presentación · peso" cuando el producto declara peso', () => {
  assert.equal(etiquetaEjesSpotlight({ presentacion: 'Molido', tamano: '250 g' }), 'Molido · 250 g');
});

test('etiquetaEjesSpotlight: sin peso, sólo la presentación — nunca un peso vacío colgando', () => {
  assert.equal(etiquetaEjesSpotlight({ presentacion: 'En grano', tamano: null }), 'En grano');
});
