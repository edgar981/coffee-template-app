import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarraEnvioGratis, CajonPanel, type CajonPanelProps } from './CartDrawer';
import type { VendedorContent } from '@/lib/config/site-content-defaults';

// Vendedor INCOMPLETO a propósito (todo vacío salvo `visible`): `vendedorEstaCompleto` exige los
// campos legales, y estos tests no afirman la línea «Vende…» — mantenerlo vacío evita que un
// `nombreCompleto`/`documentoNumero` de prueba se lea como dato real en una futura captura.
const VENDEDOR_VACIO: VendedorContent = {
  visible: true, nombreCompleto: '', tipoPersona: '', documentoTipo: '', documentoNumero: '',
  nombreComercial: '', direccion: '', ciudad: '', correo: '', telefono: '', horarioAtencion: '',
  municipioDespacho: '', transportadoras: '', diasPreparacionHabiles: '', ventanaCambiosDias: '',
};

// COMPRA-LINEAS-ONIX-CHAMISAS-1 — el cajón del carrito (`content.compra.cajon`). `<CartDrawer/>`
// completo NO se puede montar en el carril: `CartProvider` nace con `items: []` SIN forma de
// sembrar filas desde afuera (§ `cromo-carrito.test.ts`), así que el estado "vacío" es el ÚNICO que
// este render podría mostrar — no sirve para afirmar el tratamiento de una FILA de producto. Mismo
// límite, mismo mecanismo de verificación que ya usa `lib/config/detalles-sitio.test.ts` para la
// composición 'flotante' de `carrito.variante`: lectura de la FUENTE para lo que no se puede montar,
// render real para lo que SÍ se puede extraer sin contexto (`BarraEnvioGratis`, abajo).
//
// COMPRA-LINEAS-FIDELIDAD-1 — `CajonPanel` SÍ se puede montar con `renderToStaticMarkup`: no
// depende de `useCartStore`/`useSiteContent`, recibe todo por prop (§ su docstring en
// `CartDrawer.tsx`). Eso es lo que el preview del editor admin explota; los tests de abajo lo
// ejercitan por RENDER real, no sólo leyendo la fuente.

const ITEM_MUESTRA: CajonPanelProps['items'][number] = {
  key: 'muestra-1', id: 'prod-1', nombre: 'Café de muestra', imagen: '', precio: 35_000, quantity: 1,
  options: { molienda: 'En grano' },
};

function propsBase(cajon: CajonPanelProps['cajon']): CajonPanelProps {
  return {
    cajon,
    carrito: { variante: 'anclado' },
    items: [ITEM_MUESTRA],
    departamento: null,
    carritoEnvio: { visible: false },
    coloresPorProducto: {},
    vendedor: VENDEDOR_VACIO,
    onClose: () => {},
    onUpdateQuantity: () => {},
    onRemoveItem: () => {},
    onDepartamentoChange: () => {},
  };
}

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
  // COMPRA-LINEAS-FIDELIDAD-1 -- `CajonPanel` (§ abajo) ya no lee `useSiteContent()` directo: recibe
  // el mapa por prop (`coloresPorProducto`), y es `CartDrawer` quien se lo pasa desde
  // `tiendaCatalogo.coloresPorProducto` -- las dos puntas se afirman por separado.
  assert.match(src, /coloresPorProducto=\{tiendaCatalogo\.coloresPorProducto\}/, 'CartDrawer debe pasarle a CajonPanel el MISMO mapa de tiendaCatalogo');
  assert.match(src, /coloresPorProducto\[item\.id\]/, 'CajonPanel debe consumir el mapa recibido por prop');
  assert.match(src, /import \{ HEX6 \} from "@\/lib\/tienda\/laminas"/, 'reusa el mismo validador de hex que /tienda, no inventa uno');
});

test('CartDrawer.tsx: `CajonPanel` es un componente PURO exportado (sin `useCartStore`/`useSiteContent`), para que el editor admin lo pueda montar con datos de muestra', () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /export function CajonPanel\(/);
  assert.match(src, /export interface CajonPanelProps/);
  // El cuerpo de CajonPanel (hasta el cierre antes de `CartDrawer` abajo) no debe mencionar los dos
  // hooks que lo atarían a un árbol de Providers -- eso es precisamente lo que permite reusarlo.
  const inicio = src.indexOf('export function CajonPanel(');
  const fin = src.indexOf('export default function CartDrawer()');
  const cuerpo = src.slice(inicio, fin);
  assert.ok(!cuerpo.includes('useCartStore('), 'CajonPanel no debe llamar useCartStore');
  assert.ok(!cuerpo.includes('useSiteContent('), 'CajonPanel no debe llamar useSiteContent');
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

test('CartDrawer.tsx: bajo «Créditos»/«Álbum» la fila de envío NO se repite entre el bloque de arriba y el pie de filas', () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /shippingMethodCajon && !esCreditos && !esAlbum && \(/, 'el bloque de arriba se apaga bajo Créditos y bajo Álbum — COMPRA-LINEAS-FIDELIDAD-1 le dio a Álbum su propio pie de filas');
});

test('CartDrawer.tsx: «Álbum» también tiene su propio pie de totales (§ COMPRA-LINEAS-FIDELIDAD-1), entre «Créditos» y \'flotante\' en el mismo ternario', () => {
  const src = leerFuenteCartDrawer();
  const idxCreditos = src.indexOf('{esCreditos ? (');
  const idxAlbum = src.indexOf(': esAlbum ? (', idxCreditos);
  const idxFlotante = src.indexOf(': flotante ? (', idxAlbum);
  assert.ok(idxCreditos > -1 && idxAlbum > idxCreditos && idxFlotante > idxAlbum, 'el orden debe ser esCreditos → esAlbum → flotante');
});

test('CartDrawer.tsx: el título «Tu pedido (n)» reemplaza a «Tu Carrito» para cualquier cajón distinto de \'comun\'', () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /cajon === 'comun' \? \(/, 'el header debe bifurcar por cajón, no sólo por `carrito.variante`');
  assert.match(src, /Tu pedido\{' '\}/);
});

test('CartDrawer.tsx: «Quitar» es texto (no ícono) bajo «Créditos»/«Álbum» — el ícono de papelera se queda para \'comun\'', () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /esCreditos \|\| esAlbum \? \(/, 'debe haber al menos un branch compartido por los dos cajones no-comunes');
  assert.match(src, />\s*Quitar\s*<\/button>/);
  assert.match(src, /<Trash2 className="h-3\.5 w-3\.5" \/>/, 'comun conserva el ícono');
});

// ─── CajonPanel — render REAL, sin Context (§ el preview de «Camino de compra» en el admin) ───────

test('CajonPanel: `cajon="comun"` rinde "Tu Carrito" + el badge circular — igual que CartTitulo', () => {
  const html = renderToStaticMarkup(React.createElement(CajonPanel, propsBase('comun')));
  assert.match(html, /Tu Carrito/);
  assert.doesNotMatch(html, /Tu pedido/);
});

test('CajonPanel: `cajon="creditos"` rinde "Tu pedido (n)" en mayúscula, el stepper cuadrado y "Quitar" como texto', () => {
  const html = renderToStaticMarkup(React.createElement(CajonPanel, propsBase('creditos')));
  assert.match(html, /Tu pedido/);
  assert.match(html, /uppercase tracking-wide/, 'el título de Onix lleva la clase de mayúscula');
  assert.match(html, /border border-\[var\(--sf-tinta\)\]/, 'el stepper cuadrado de Onix');
  assert.match(html, />Quitar<\/button>/);
  assert.match(html, /IR A PAGAR/, 'el CTA repite el verbo en mayúscula + el total');
});

test('CajonPanel: `cajon="album"` rinde "Tu pedido (n)" en registro normal, el stepper en píldora y su propio pie de totales', () => {
  const html = renderToStaticMarkup(React.createElement(CajonPanel, propsBase('album')));
  assert.match(html, /Tu pedido/);
  assert.doesNotMatch(html, /uppercase tracking-wide/);
  assert.match(html, /rounded-full border border-\[var\(--sf-linea\)\]/, 'el stepper en píldora de Álbum');
  assert.match(html, />Quitar<\/button>/);
  assert.match(html, /Ir a pagar · \$/, 'el CTA en registro normal, con el total');
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
