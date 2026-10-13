import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// COMPRA-LINEAS-ONIX-CHAMISAS-1 — el seguimiento (`content.compra.seguimiento`). La página entera
// usa `useSearchParams()` (next/navigation) dentro de un `<Suspense>`, así que no se puede montar
// con `renderToStaticMarkup` sin un árbol de ruteo real de Next — el mismo límite que ya documenta
// `CartDrawer.test.ts` para el contexto del carrito, aplicado acá al router. La resolución del eje
// (`composicionSeguimiento`) ya se afirma por EJECUCIÓN en `lib/checkout/composiciones-compra.
// test.ts`; esto verifica que la página de verdad la CONSUME, por lectura de la fuente.
//
// COMPRA-LINEAS-FIDELIDAD-1 — la línea de tiempo se extrajo a `SeguimientoTimeline` (§ su
// docstring en `page.tsx`): no depende de `useSearchParams`/Context, así que SÍ se puede montar
// con `renderToStaticMarkup` — el bloque de abajo ("SeguimientoTimeline — render REAL") la ejercita
// por EJECUCIÓN, no sólo por lectura de fuente. Los tests de lectura que siguen afirman que
// `OrderTrackingInner` la sigue consumiendo, con el nombre que antes tenían los branches inline.

function leerFuentePagina(): string {
  const srcPath = path.join(fileURLToPath(new URL('.', import.meta.url)), 'page.tsx');
  return readFileSync(srcPath, 'utf8');
}

test('rastrear-pedido/page.tsx: lee `compra` de `useSiteContent()` y resuelve `seguimiento` con `composicionSeguimiento`', () => {
  const src = leerFuentePagina();
  assert.match(src, /import \{ composicionSeguimiento \} from '@\/lib\/checkout\/composiciones-compra'/);
  assert.match(src, /const seguimiento = composicionSeguimiento\(compra\.seguimiento\)/);
});

test('rastrear-pedido/page.tsx: `OrderTrackingInner` monta `SeguimientoTimeline` pasándole `seguimiento` y la fecha REAL de la orden', () => {
  const src = leerFuentePagina();
  assert.match(src, /<SeguimientoTimeline seguimiento=\{seguimiento\} currentStep=\{currentStep\} fechaPedido=\{order\.createdAt\} \/>/);
});

test('SeguimientoTimeline.tsx: la línea de tiempo tiene TRES ramas — escaleta, álbum, y la común sin tocar', () => {
  const src = leerFuentePagina();
  assert.match(src, /if \(esEscaleta\) \{/);
  assert.match(src, /if \(esAlbumSeguimiento\) \{/);
  // La rama común (el `return` final de la función) conserva el mapeo de ícono por paso de
  // SIEMPRE — ningún texto nuevo se coló en la rama que no eligió nada.
  const idxComun = src.lastIndexOf('const Icon = step.icon;');
  assert.ok(idxComun > -1);
});

test('SeguimientoTimeline.tsx: la rama "escaleta" usa `formatFecha` sobre `fechaPedido` (la prop — nunca `order.createdAt` directo, para que el preview del editor pueda pasar una fecha de muestra)', () => {
  const src = leerFuentePagina();
  const inicio = src.indexOf('if (esEscaleta) {');
  const fin = src.indexOf('if (esAlbumSeguimiento) {');
  const bloque = src.slice(inicio, fin);
  assert.match(bloque, /formatFecha\(fechaPedido\)/);
  assert.doesNotMatch(bloque, /order\.createdAt/, 'SeguimientoTimeline no debe tocar `order` — eso rompería el preview sin una orden real');
  // Sólo en el paso ACTIVO — nunca en los demás, que no tienen ese dato.
  assert.match(bloque, /\{active && \(/);
});

test('SeguimientoTimeline.tsx: la rama "album" pinta los pasos CUMPLIDOS como sticker (rotado) y los PENDIENTES con borde punteado', () => {
  const src = leerFuentePagina();
  const inicio = src.indexOf('if (esAlbumSeguimiento) {');
  assert.ok(inicio > -1);
  // Ventana generosa que cubre el branch entero (medido: ~1.8k caracteres) sin llegar al `if`
  // siguiente — `-rotate-6`/el borde punteado son strings que NO aparecen en ningún otro branch de
  // este archivo, así que la ventana sólo necesita ser "suficientemente grande", no exacta.
  const bloque = src.slice(inicio, inicio + 2200);
  assert.match(bloque, /-rotate-6/);
  assert.match(bloque, /border-2 border-dashed border-\[var\(--sf-linea\)\]/);
});

// ─── SeguimientoTimeline — render REAL, sin Context (§ el preview de «Camino de compra» en el admin) ──

test('SeguimientoTimeline: `seguimiento="escaleta"` rinde el filete vertical y la fecha de muestra en el paso activo', async () => {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SeguimientoTimeline } = await import('./page');
  const html = renderToStaticMarkup(
    React.createElement(SeguimientoTimeline, { seguimiento: 'escaleta', currentStep: 2, fechaPedido: '2026-10-12T10:00:00.000Z' }),
  );
  assert.match(html, /uppercase tracking-wide/, 'la etiqueta del paso va en mayúscula bajo escaleta');
  assert.match(html, /PREPARANDO|Preparando/i);
});

test('SeguimientoTimeline: `seguimiento="album"` rinde el sticker rotado para los pasos cumplidos', async () => {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SeguimientoTimeline } = await import('./page');
  const html = renderToStaticMarkup(
    React.createElement(SeguimientoTimeline, { seguimiento: 'album', currentStep: 1, fechaPedido: '2026-10-12T10:00:00.000Z' }),
  );
  assert.match(html, /-rotate-6/);
});

test('SeguimientoTimeline: `seguimiento="comun"` rinde la línea de tiempo de siempre (sin filete fino ni sticker)', async () => {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SeguimientoTimeline } = await import('./page');
  const html = renderToStaticMarkup(
    React.createElement(SeguimientoTimeline, { seguimiento: 'comun', currentStep: 0, fechaPedido: '2026-10-12T10:00:00.000Z' }),
  );
  assert.doesNotMatch(html, /-rotate-6/);
  assert.doesNotMatch(html, /uppercase tracking-wide/);
});
