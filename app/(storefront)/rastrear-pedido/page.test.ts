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

function leerFuentePagina(): string {
  const srcPath = path.join(fileURLToPath(new URL('.', import.meta.url)), 'page.tsx');
  return readFileSync(srcPath, 'utf8');
}

test('rastrear-pedido/page.tsx: lee `compra` de `useSiteContent()` y resuelve `seguimiento` con `composicionSeguimiento`', () => {
  const src = leerFuentePagina();
  assert.match(src, /import \{ composicionSeguimiento \} from '@\/lib\/checkout\/composiciones-compra'/);
  assert.match(src, /const seguimiento = composicionSeguimiento\(compra\.seguimiento\)/);
});

test('rastrear-pedido/page.tsx: la línea de tiempo tiene TRES ramas — escaleta, álbum, y la común sin tocar', () => {
  const src = leerFuentePagina();
  assert.match(src, /\) : esEscaleta \? \(/);
  assert.match(src, /\) : esAlbumSeguimiento \? \(/);
  // La rama común (el `else` final) conserva el mapeo de ícono por paso de SIEMPRE — ningún texto
  // nuevo se coló en la rama que no eligió nada.
  const idxComun = src.lastIndexOf('const Icon = step.icon;');
  assert.ok(idxComun > -1);
});

test('rastrear-pedido/page.tsx: la rama "escaleta" usa `formatFecha` sobre `order.createdAt` — nunca una fecha inventada por paso', () => {
  const src = leerFuentePagina();
  const inicio = src.indexOf('esEscaleta ? (');
  const fin = src.indexOf('esAlbumSeguimiento ? (');
  const bloque = src.slice(inicio, fin);
  assert.match(bloque, /formatFecha\(order\.createdAt\)/);
  // Sólo en el paso ACTIVO — nunca en los demás, que no tienen ese dato.
  assert.match(bloque, /\{active && \(/);
});

test('rastrear-pedido/page.tsx: la rama "album" pinta los pasos CUMPLIDOS como sticker (rotado) y los PENDIENTES con borde punteado', () => {
  const src = leerFuentePagina();
  const inicio = src.indexOf('esAlbumSeguimiento ? (');
  assert.ok(inicio > -1);
  // Ventana generosa que cubre el branch entero (medido: ~1.8k caracteres) sin llegar al ternario
  // siguiente — `-rotate-6`/el borde punteado son strings que NO aparecen en ningún otro branch de
  // este archivo, así que la ventana sólo necesita ser "suficientemente grande", no exacta.
  const bloque = src.slice(inicio, inicio + 2200);
  assert.match(bloque, /-rotate-6/);
  assert.match(bloque, /border-2 border-dashed border-\[var\(--sf-linea\)\]/);
});
