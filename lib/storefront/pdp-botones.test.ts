import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clasesBotonesCompra, claseBotonFavoritos } from './pdp-botones';

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

// § DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1 — cantidad/favoritos parejos en alto/borde/color con
// "Agregar al carrito", sólo bajo CORTE; Nayoli byte-idéntica.

test('clasesBotonesCompra(null/"tostado"): cantidad es BYTE-IDÉNTICA a lo que `page.tsx` tenía antes de este slice', () => {
  const { cantidad, cantidadBoton } = clasesBotonesCompra(null);
  assert.equal(cantidad, 'flex items-center gap-2 bg-[var(--sf-superficie)] rounded-xl px-1');
  assert.equal(cantidadBoton, 'w-9 h-9 flex items-center justify-center hover:bg-[var(--sf-linea)] sf-radio-lg transition-colors cursor-pointer');
  assert.deepEqual(clasesBotonesCompra('tostado'), clasesBotonesCompra(null));
});

test('clasesBotonesCompra("acento"): CANTIDAD toma el MISMO padding vertical que "Agregar al carrito" (`py-[18px]`) — mismo padding + mismo alto de línea es lo que garantiza el mismo alto final', () => {
  const { cantidad, secundario } = clasesBotonesCompra('acento');
  assert.match(cantidad, /py-\[18px\]/);
  assert.match(secundario, /py-\[18px\]/);
});

test('clasesBotonesCompra("acento"): CANTIDAD usa el MISMO borde/color que "Agregar al carrito" (`sf-borde border-[var(--sf-acento)]`) — el mismo token, no una aproximación', () => {
  const { cantidad } = clasesBotonesCompra('acento');
  assert.match(cantidad, /\bsf-borde\b/);
  assert.match(cantidad, /border-\[var\(--sf-acento\)\]/);
});

test('clasesBotonesCompra("acento"): los botones −/+ NO llevan un alto propio (`h-9` ni ningún `h-`) — su línea la da el ícono, igual que el texto define la de "Agregar al carrito"', () => {
  const { cantidadBoton } = clasesBotonesCompra('acento');
  assert.doesNotMatch(cantidadBoton, /\bh-9\b/);
  assert.doesNotMatch(cantidadBoton, /\bh-\[/);
});

test('claseBotonFavoritos(null/"tostado", …): BYTE-IDÉNTICO a lo que `page.tsx` tenía antes de este slice, en los dos estados', () => {
  assert.equal(
    claseBotonFavoritos(null, false),
    'w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all border-[var(--sf-linea)] text-[var(--sf-tostado-3)] hover:border-red-300',
  );
  assert.equal(
    claseBotonFavoritos(null, true),
    'w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all border-red-400 bg-red-50 text-red-500',
  );
  assert.deepEqual(claseBotonFavoritos('tostado', false), claseBotonFavoritos(null, false));
});

test('claseBotonFavoritos("acento", …): SIN alto propio — `aspect-square` deriva el ancho del alto del flex row que comparte con "Agregar al carrito" ("el corazón, cuadrado del alto del botón")', () => {
  const sinWishlist = claseBotonFavoritos('acento', false);
  assert.match(sinWishlist, /\baspect-square\b/);
  assert.doesNotMatch(sinWishlist, /\bh-12\b/);
  assert.doesNotMatch(sinWishlist, /\bw-12\b/);
});

test('claseBotonFavoritos("acento", …): MISMO borde/token que "Agregar al carrito" en los DOS estados', () => {
  const sinWishlist = claseBotonFavoritos('acento', false);
  const conWishlist = claseBotonFavoritos('acento', true);
  assert.match(sinWishlist, /\bsf-borde\b/);
  assert.match(sinWishlist, /border-\[var\(--sf-acento\)\]/);
  assert.match(conWishlist, /\bsf-borde\b/);
  assert.match(conWishlist, /border-\[var\(--sf-acento\)\]/);
});

test('claseBotonFavoritos("acento", true): ya en la lista de deseos, se pinta LLENO de acento — mismo tratamiento "seleccionado" que un chip de molienda activo', () => {
  const conWishlist = claseBotonFavoritos('acento', true);
  assert.match(conWishlist, /bg-\[var\(--sf-acento\)\]/);
  assert.match(conWishlist, /text-\[var\(--sf-acento-txt\)\]/);
});
