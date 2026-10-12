import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarraEnvioGratis } from './CartDrawer';

// COMPRA-LINEAS-ONIX-CHAMISAS-1 — el cajón del carrito (`content.compra.cajon`). `<CartDrawer/>`
// completo NO se puede montar en el carril: `CartProvider` nace con `items: []` SIN forma de
// sembrar filas desde afuera (§ `cromo-carrito.test.ts`), así que el estado "vacío" es el ÚNICO que
// este render podría mostrar — no sirve para afirmar el tratamiento de una FILA de producto. Mismo
// límite, mismo mecanismo de verificación que ya usa `lib/config/detalles-sitio.test.ts` para la
// composición 'flotante' de `carrito.variante`: lectura de la FUENTE para lo que no se puede montar,
// render real para lo que SÍ se puede extraer sin contexto (`BarraEnvioGratis`, abajo).

function leerFuenteCartDrawer(): string {
  const srcPath = path.join(fileURLToPath(new URL('.', import.meta.url)), 'CartDrawer.tsx');
  return readFileSync(srcPath, 'utf8');
}

test('CartDrawer.tsx: lee `compra` de `useSiteContent()` y resuelve `cajon` con `composicionCajon`', () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /import \{ composicionCajon \} from "@\/lib\/checkout\/composiciones-compra"/);
  assert.match(src, /const cajon = composicionCajon\(compra\.cajon\)/);
});

test('CartDrawer.tsx: la franja de tejido de la cabecera va gateada por `esAlbum`, nunca incondicional', () => {
  const src = leerFuenteCartDrawer();
  const idx = src.indexOf('esAlbum &&');
  assert.ok(idx > -1, 'debe haber un branch `esAlbum && (…)`');
  assert.ok(src.indexOf('{/* Header */}') > idx, 'la franja va ANTES del header, como banda propia');
});

test('CartDrawer.tsx: la miniatura sobre el color del café usa `tiendaCatalogo.coloresPorProducto`, el MISMO mapa de la lámina de /tienda — nunca un color nuevo', () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /tiendaCatalogo\.coloresPorProducto\[item\.id\]/);
  assert.match(src, /import \{ HEX6 \} from "@\/lib\/tienda\/laminas"/, 'reusa el mismo validador de hex que /tienda, no inventa uno');
});

test('CartDrawer.tsx: la fila de molienda bajo «Créditos» pierde el prefijo "Molienda:" y gana mayúscula espaciada', () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /esCreditos \? \(/);
  assert.match(src, /uppercase tracking-wider/);
});

test('CartDrawer.tsx: el pie «Créditos» tiene prioridad sobre \'flotante\' — es el PRIMER branch del ternario de totales', () => {
  const src = leerFuenteCartDrawer();
  const idxTernario = src.indexOf('{esCreditos ? (');
  const idxFlotante = src.indexOf(': flotante ? (');
  assert.ok(idxTernario > -1 && idxFlotante > idxTernario, 'esCreditos debe evaluarse ANTES que flotante en el mismo ternario');
});

test('CartDrawer.tsx: bajo «Créditos» la fila de envío NO se repite entre el bloque de arriba y el pie de filas', () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /shippingMethodCajon && !esCreditos && \(/, 'el bloque de arriba se apaga bajo Créditos');
});

// ─── BarraEnvioGratis — SÍ se puede montar sin contexto (recibe todo por prop) ────────────────────

test('BarraEnvioGratis: `tejido` ausente/false es BYTE-IDÉNTICO al relleno liso de siempre', () => {
  const html = renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 10_000, threshold: 50_000 }));
  assert.ok(html.includes('bg-[var(--sf-accion,var(--sf-tostado))]'));
  assert.ok(!html.includes('repeating-linear-gradient'));
});

test('BarraEnvioGratis: `tejido=true` (composición «Álbum») pinta el relleno como tejido — rayas diagonales, mismos tokens', () => {
  const html = renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 10_000, threshold: 50_000, tejido: true }));
  assert.ok(html.includes('repeating-linear-gradient'));
  assert.ok(html.includes('var(--sf-accion'), 'sigue siendo el MISMO token de acento, no un color nuevo');
});

test('BarraEnvioGratis: la transición de ancho (§ "el tejido avanza al subir el subtotal") se conserva en los dos modos', () => {
  const liso = renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 10_000, threshold: 50_000 }));
  const tejido = renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 10_000, threshold: 50_000, tejido: true }));
  assert.ok(liso.includes('transition-all duration-500'));
  assert.ok(tejido.includes('transition-all duration-500'));
});

test('BarraEnvioGratis: sin progreso (umbral null), ninguno de los dos modos renderiza nada', () => {
  assert.equal(renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 10_000, threshold: null })), '');
  assert.equal(renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 10_000, threshold: null, tejido: true })), '');
});
