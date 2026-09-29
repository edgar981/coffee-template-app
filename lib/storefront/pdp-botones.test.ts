import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clasesBotonesCompra } from './pdp-botones';

// § PARIDAD-PDP-BOTONES-1 — el porqué completo (el mecanismo, por qué `origenAccion` y no `forma`,
// por qué ningún campo nuevo de SiteContent) vive en el docstring de `pdp-botones.ts`. Lo PURO y por
// tanto afirmable acá es la DECISIÓN: qué clases corresponden a cada valor del eje. El render real
// (¿se ve el botón sólido en la pantalla?) es capa 3.

test('clasesBotonesCompra(null): Nayoli byte-idéntica — "Comprar ahora" en contorno, "Agregar al carrito" sólido en tinta', () => {
  const { primario, secundario } = clasesBotonesCompra(null);
  // "Comprar ahora" (primario acá) sigue siendo el CONTORNO de acento de siempre — nunca sólido.
  assert.match(primario, /border-2 border-\[var\(--sf-acento\)\]/);
  assert.doesNotMatch(primario, /^w-full flex items-center justify-center gap-2 sf-pildora bg-\[var\(--sf-acento\)\]/);
  // "Agregar al carrito" (secundario acá) sigue siendo el SÓLIDO en tinta de siempre — nunca contorno.
  assert.match(secundario, /bg-\[var\(--sf-tinta\)\]/);
  assert.doesNotMatch(secundario, /sf-pildora/);
});

test('clasesBotonesCompra("tostado"): el mismo comportamiento que null — sólo "acento" activa el tratamiento del prototipo', () => {
  const conNull = clasesBotonesCompra(null);
  const conTostado = clasesBotonesCompra('tostado');
  assert.deepEqual(conTostado, conNull);
});

test('clasesBotonesCompra("acento"): CORTE — "Comprar ahora" pasa a ser el PRIMARIO sólido de acento', () => {
  const { primario } = clasesBotonesCompra('acento');
  assert.match(primario, /bg-\[var\(--sf-acento\)\]/);
  assert.match(primario, /text-\[var\(--sf-acento-txt\)\]/);
  assert.match(primario, /hover:bg-\[var\(--sf-accion-hover,var\(--sf-tostado-4\)\)\]/);
  assert.match(primario, /active:bg-\[var\(--sf-accion-active,var\(--sf-tostado-3\)\)\]/);
  assert.doesNotMatch(primario, /border-2 border-\[var\(--sf-acento\)\]/);
});

test('clasesBotonesCompra("acento"): CORTE — "Comprar ahora" NO usa el mecanismo viejo (`--sf-acento-3`/`-2`, § CTA-HOVER-RESTO-FAMILIA-1) que desviaba el hue hacia la tinta', () => {
  const { primario } = clasesBotonesCompra('acento');
  assert.doesNotMatch(primario, /--sf-acento-3/);
  assert.doesNotMatch(primario, /--sf-acento-2/);
});

test('clasesBotonesCompra("acento"): CORTE — "Agregar al carrito" pasa a ser el SECUNDARIO de contorno que se llena de acento al hover', () => {
  const { secundario } = clasesBotonesCompra('acento');
  assert.match(secundario, /border-\[var\(--sf-acento\)\]/);
  assert.match(secundario, /hover:bg-\[var\(--sf-acento\)\]/);
  assert.match(secundario, /hover:text-\[var\(--sf-acento-txt\)\]/);
  assert.doesNotMatch(secundario, /bg-\[var\(--sf-tinta\)\]/);
});

test('clasesBotonesCompra("acento"): CORTE — "Agregar al carrito" usa `--sf-accion-active` para su active (no `--sf-acento-2`, § CTA-HOVER-RESTO-FAMILIA-1) — el hover se queda en `--sf-acento` crudo, que ya coincide con el prototipo', () => {
  const { secundario } = clasesBotonesCompra('acento');
  assert.match(secundario, /active:bg-\[var\(--sf-accion-active,var\(--sf-tostado-3\)\)\]/);
  assert.doesNotMatch(secundario, /--sf-acento-2/);
  assert.doesNotMatch(secundario, /--sf-acento-3/);
});

test('clasesBotonesCompra("acento"): el TEXTO del secundario va en `--sf-acento` CRUDO, nunca `--sf-acento-texto` — CORTE redirige ese token a la TINTA vía `origenTexto:\'tinta\'` (medido: `--sf-acento-texto` resuelve `#102407`, no `#a70004`), así que usarlo repetiría el defecto del CENSO (borde rojo, texto tinta, dos colores en el mismo botón)', () => {
  const { secundario } = clasesBotonesCompra('acento');
  // El texto BASE (sin prefijo hover:/active:) va en `--sf-acento` crudo, mismo token que el borde.
  assert.match(secundario, /border-\[var\(--sf-acento\)\] text-\[var\(--sf-acento\)\] hover:/);
  assert.doesNotMatch(secundario, /text-\[var\(--sf-acento-texto\)\]/);
});

test('clasesBotonesCompra("acento"): los dos toman el radio del TEMA (`sf-pildora`, 0 bajo `forma:\'recta\'` de CORTE) — nunca un radio fijo', () => {
  const { primario, secundario } = clasesBotonesCompra('acento');
  assert.match(primario, /\bsf-pildora\b/);
  assert.match(secundario, /\bsf-pildora\b/);
  assert.doesNotMatch(primario, /rounded-2xl/);
  assert.doesNotMatch(secundario, /rounded-2xl/);
});
