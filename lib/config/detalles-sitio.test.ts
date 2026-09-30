import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  progresoEnvioGratis,
  FraseEnvioGratis,
  BarraEnvioGratis,
  CartTitulo,
} from '@/components/storefront/CartDrawer';
import { formatCOP } from '@duna/core/utils';
import { DEFAULTS, resolverCarritoEnvio, resolverCarrito } from './site-content-defaults';
import { siteContentEditableSchema } from './site-content-schema';
import { CORTE, mergePresetEnContent } from './themes';
import { camposControladosPorPanel, huecosDelPanel } from './panel-controles';

// Los montos se componen con `formatCOP` (lleva ESPACIO DURO, U+00A0, no un espacio normal) --
// nunca se transcriben a mano en los asserts de abajo, precedente `lib/pagos/frase.test.ts`.
const money = (n: number) => formatCOP(n);

// § MUESTRARIO-CARRITO-BARRA-ENVIO-1. Capa 1, SIN base (`lib/**/*.test.ts` es el glob DB-FREE del
// carril rápido, § CLAUDE.md "El carril rápido cubre `app/`" -- la MISMA regla aplicada a `lib/`):
// nada acá habla con Postgres. `CartDrawer` completo no se puede montar en el carril (es un CONTEXT
// con throw duro sin `CartProvider`/`SiteContentProvider`, § `cromo-carrito.test.ts`), así que las
// piezas de esta tanda (`progresoEnvioGratis`/`FraseEnvioGratis`/`BarraEnvioGratis`) se afirman
// EXTRAÍDAS, por el mismo mecanismo que ya usa ese archivo -- sin hooks, sin mockear nada.

// ─── progresoEnvioGratis — la mitad PURA ────────────────────────────────────────────────────────────

test('progresoEnvioGratis: umbral null (sin configurar) -> null, mismo criterio que ya gobierna la frase', () => {
  assert.equal(progresoEnvioGratis(50_000, null), null);
});

test('progresoEnvioGratis: subtotal por debajo del umbral -> "Te faltan $X" y el pct proporcional', () => {
  const r = progresoEnvioGratis(50_000, 150_000);
  assert.ok(r);
  assert.equal(r!.mensaje, `Te faltan ${money(100_000)} para envío gratis`);
  assert.ok(Math.abs(r!.pct - (50_000 / 150_000) * 100) < 1e-9);
});

test('progresoEnvioGratis: un progreso real pero bajo no cae a 0 -- piso de 4 (§ js/app.js del muestrario)', () => {
  const r = progresoEnvioGratis(1_000, 150_000);
  assert.ok(r);
  assert.equal(r!.pct, 4);
});

test('progresoEnvioGratis: subtotal == umbral -> "Tienes envío gratis", pct 100', () => {
  const r = progresoEnvioGratis(150_000, 150_000);
  assert.deepEqual(r, { pct: 100, mensaje: 'Tienes envío gratis' });
});

test('progresoEnvioGratis: subtotal por encima del umbral -> igual "Tienes envío gratis", pct 100', () => {
  const r = progresoEnvioGratis(200_000, 150_000);
  assert.deepEqual(r, { pct: 100, mensaje: 'Tienes envío gratis' });
});

// ─── FraseEnvioGratis — APAGADA rinde la frase de hoy, byte-idéntico ───────────────────────────────

test('FraseEnvioGratis: belowFreeShipping=false -> no renderiza nada (el caso "ya alcanzó el umbral" de hoy)', () => {
  const html = renderToStaticMarkup(React.createElement(FraseEnvioGratis, { belowFreeShipping: false, threshold: 150_000 }));
  assert.equal(html, '');
});

test('FraseEnvioGratis: belowFreeShipping=true -> el MISMO markup que CartDrawer.tsx rendía inline antes de esta tanda', () => {
  const html = renderToStaticMarkup(React.createElement(FraseEnvioGratis, { belowFreeShipping: true, threshold: 150_000 }));
  assert.equal(
    html,
    `<p class="text-xs text-[var(--sf-texto-suave)]">Envío gratis en pedidos mayores a ${money(150_000)}</p>`,
  );
});

// ─── BarraEnvioGratis — ENCENDIDA rinde la barra, y su relleno sale de un TOKEN ─────────────────────

test('BarraEnvioGratis: umbral null (sin configurar) -> no se muestra, MISMO criterio que la frase', () => {
  const html = renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 50_000, threshold: null }));
  assert.equal(html, '');
});

test('BarraEnvioGratis: por debajo del umbral -> el mensaje "Te faltan…" y una barra con el % de avance en `width`', () => {
  const html = renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 50_000, threshold: 150_000 }));
  assert.ok(html.includes(`Te faltan ${money(100_000)} para envío gratis`));
  assert.match(html, /style="width:33\.3\d*%"/);
});

test('BarraEnvioGratis: al alcanzar el umbral -> "Tienes envío gratis" con la barra al 100%', () => {
  const html = renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 150_000, threshold: 150_000 }));
  assert.match(html, /Tienes envío gratis/);
  assert.match(html, /style="width:100%"/);
});

test('BarraEnvioGratis: el relleno usa el TOKEN de acción (`--sf-accion`, con fallback a `--sf-tostado`) -- NUNCA un color hardcodeado', () => {
  const html = renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 50_000, threshold: 150_000 }));
  assert.match(html, /class="[^"]*bg-\[var\(--sf-accion,var\(--sf-tostado\)\)\][^"]*"/, 'el relleno debe leer el token de ACCIÓN, el mismo que ya pintan BackToTop y CartCTA');
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}/, 'ningún hex literal horneado en el relleno');
  assert.doesNotMatch(html, /rgba?\(/, 'ningún rgb()/rgba() literal horneado en el relleno');
});

// ─── § CARRITO-BARRA-POSICION-1 — la barra con el carrito VACÍO (subtotal 0), como el muestrario ──
//
// Medido contra `docs/prototipos/cafeone/js/app.js:398-405` (`renderCart`): actualiza
// `data-ship-msg`/`data-ship-bar` SIEMPRE, sin condicionar a `cart.length` -- con el carrito vacío
// `total` es 0, así que muestra "Te faltan $<threshold completo>" con el piso de 4%. `BarraEnvioGratis`
// ya es pura sobre `subtotal`/`threshold` (no conoce `items`), así que subtotal=0 ya ejerce el caso
// "carrito vacío" sin que el componente necesite ningún cambio de lógica -- sólo de POSICIÓN en
// `CartDrawer.tsx` (abajo).

test('BarraEnvioGratis: subtotal=0 (carrito vacío, como el muestrario) -> "Te faltan $<threshold completo>" con el piso de 4%, NO oculta nada', () => {
  const html = renderToStaticMarkup(React.createElement(BarraEnvioGratis, { subtotal: 0, threshold: 150_000 }));
  assert.ok(html.includes(`Te faltan ${money(150_000)} para envío gratis`));
  assert.match(html, /style="width:4%"/);
});

// ─── § CARRITO-BARRA-POSICION-1 — LA POSICIÓN en CartDrawer.tsx, por lectura de la fuente ──────────
//
// `<CartDrawer/>` no se puede montar en el carril (§ cromo-carrito.test.ts, arriba: `useCartStore`
// es un CONTEXT con throw duro sin `CartProvider`), así que el orden estructural del JSX -- que la
// barra quede ANTES del listado/estado-vacío y ya no dependa de `items.length` -- se afirma leyendo
// la fuente, el mismo mecanismo que `spotlight-cableado.test.ts` usa para el cableado del
// dispatcher.

function leerFuenteCartDrawer(): string {
  const srcPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../components/storefront/CartDrawer.tsx');
  return readFileSync(srcPath, 'utf8');
}

test('CartDrawer.tsx: `<BarraEnvioGratis` aparece ANTES de `items.length === 0` -- la barra vive arriba del cuerpo, antes del listado', () => {
  const src = leerFuenteCartDrawer();
  const idxBarra = src.indexOf('<BarraEnvioGratis');
  const idxListado = src.indexOf('items.length === 0');
  assert.ok(idxBarra > -1, 'BarraEnvioGratis debe seguir montada en CartDrawer.tsx');
  assert.ok(idxListado > -1, 'la rama del estado vacío/listado debe seguir presente');
  assert.ok(idxBarra < idxListado, 'BarraEnvioGratis debe aparecer ANTES de la rama items.length === 0, como .ship-prog antes de data-lines en el muestrario');
});

test('CartDrawer.tsx: la barra se gatea SÓLO por `carritoEnvio.visible`, nunca por `items.length` -- aparece con carrito vacío', () => {
  const src = leerFuenteCartDrawer();
  const bloque = src.slice(src.indexOf('{carritoEnvio.visible && ('), src.indexOf('<BarraEnvioGratis') + 50);
  assert.ok(bloque.includes('<BarraEnvioGratis'), 'el bloque `carritoEnvio.visible && (…)` debe envolver directamente a BarraEnvioGratis');
  assert.ok(!bloque.includes('items.length'), 'ese bloque no debe condicionar la barra a que haya ítems -- el prototipo la muestra con el carrito vacío');
});

test('CartDrawer.tsx: `<BarraEnvioGratis` aparece UNA sola vez en la fuente -- ya no vive duplicada en el footer', () => {
  const src = leerFuenteCartDrawer();
  const ocurrencias = src.split('<BarraEnvioGratis').length - 1;
  assert.equal(ocurrencias, 1, 'la barra se movió, no se copió: el footer ya no debe montarla');
});

test('CartDrawer.tsx: el footer sigue rindiendo `FraseEnvioGratis` SÓLO cuando el gate está apagado, dentro de `items.length > 0` -- byte-idéntica al comportamiento de siempre', () => {
  const src = leerFuenteCartDrawer();
  const idxFooter = src.indexOf('{/* Footer */}');
  const footer = src.slice(idxFooter);
  assert.match(footer, /\{!carritoEnvio\.visible && \(/, 'el footer debe condicionar la frase a `!carritoEnvio.visible`, no al ternario viejo');
  assert.match(footer, /<FraseEnvioGratis/);
  const idxItemsFooter = footer.indexOf('items.length > 0');
  const idxFrase = footer.indexOf('<FraseEnvioGratis');
  assert.ok(idxItemsFooter > -1 && idxItemsFooter < idxFrase, 'la frase debe seguir DENTRO del bloque `items.length > 0` del footer, sin cambios');
});

// ─── resolverCarritoEnvio — el resolver SOFT de la meta ─────────────────────────────────────────────

test('resolverCarritoEnvio: sin nada guardado -> el default (false, byte-idéntico)', () => {
  assert.deepEqual(resolverCarritoEnvio(undefined, DEFAULTS.carritoEnvio), { visible: false });
  assert.deepEqual(DEFAULTS.carritoEnvio, { visible: false });
});

test('resolverCarritoEnvio: guardado explícito true sobrevive', () => {
  assert.deepEqual(resolverCarritoEnvio({ visible: true }, DEFAULTS.carritoEnvio), { visible: true });
});

test('resolverCarritoEnvio: basura (no-booleano) cae al default, nunca lanza', () => {
  for (const basura of [null, undefined, 'x', 42, [], { visible: 'sí' }]) {
    assert.deepEqual(resolverCarritoEnvio(basura, DEFAULTS.carritoEnvio), { visible: false });
  }
});

// ─── La meta está en la ALLOWLIST del route (`siteContentEditableSchema`, la MISMA que
// `app/api/site-content/detalles/route.ts` acota con `.pick()`) — sin esto, el schema STRIPPEARÍA
// `carritoEnvio` en silencio al guardar (§ CLAUDE.md, el modo de falla del #65-B). ─────────────────

test('carritoEnvio está declarado en siteContentEditableSchema -- no lo strippea al parsear', () => {
  const parsed = siteContentEditableSchema.parse({
    volverArriba: { visible: true },
    rielSocial: { visible: true },
    carritoEnvio: { visible: true },
  });
  assert.equal(parsed.carritoEnvio?.visible, true);
});

test('el `.pick({carritoEnvio: true})` que usa la ruta propia sigue aceptando y preservando la clave', () => {
  const detallesSchema = siteContentEditableSchema.pick({ volverArriba: true, rielSocial: true, carritoEnvio: true });
  const parsed = detallesSchema.parse({ carritoEnvio: { visible: true } });
  assert.deepEqual(parsed, { carritoEnvio: { visible: true } });
});

// ─── El control del panel — huecosDelPanel() sigue en [], el techo del trinquete no sube ───────────

test('carritoEnvio.visible tiene control en el panel (DetallesSitioSeccion.tsx)', () => {
  assert.ok(camposControladosPorPanel().includes('carritoEnvio.visible'));
});

test('huecosDelPanel(): con la meta nueva, sigue sin quedar ningún campo sin control', () => {
  assert.deepEqual(huecosDelPanel(), []);
});

// ─── CORTE es el único preset del catálogo que enciende la barra ───────────────────────────────────

test('mergePresetEnContent(_, CORTE).carritoEnvio.visible === true -- CORTE la enciende', () => {
  const out = mergePresetEnContent({}, CORTE);
  assert.equal((out.carritoEnvio as { visible: boolean }).visible, true);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// § MUESTRARIO-CARRITO-COMPOSICION-1 -- la VARIANTE de composición del cajón del carrito
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// ─── CartTitulo -- byte-idéntica sin variante (o 'anclado'), tamaño/peso de titular con 'flotante' ──

test('CartTitulo: sin variante (llamada sin props, como cromo-carrito.test.ts) -- byte-idéntica al markup de siempre', () => {
  const html = renderToStaticMarkup(React.createElement(CartTitulo));
  assert.equal(html, '<h2 class="font-playfair font-semibold text-[var(--sf-tinta)]">Tu Carrito</h2>');
});

// `React.createElement<{variante?}>` con el tipo EXPLÍCITO: con las dos props opcionales, la
// inferencia genérica del overload de `createElement` colapsa a `P={}` y rechaza `variante` como
// "propiedad desconocida" -- el mismo eje del prop-type all-optional de `CartTitulo`. Pasar el tipo
// explícito no es un patrón nuevo del repo, es lo que este caso puntual exige.
type PropsCartTitulo = { variante?: 'anclado' | 'flotante' };

test("CartTitulo: variante='anclado' explícita -- MISMO markup que sin props", () => {
  const html = renderToStaticMarkup(React.createElement<PropsCartTitulo>(CartTitulo, { variante: 'anclado' }));
  assert.equal(html, '<h2 class="font-playfair font-semibold text-[var(--sf-tinta)]">Tu Carrito</h2>');
});

// § CARRITO-CABECERA-Y-COLORES-NAV-1 (2026-09-30) -- BAJA de `text-3xl` (30px) a `text-2xl` (24px),
// tamaño de SUBTÍTULO en vez del display grande de MUESTRARIO-CARRITO-COMPOSICION-1. Owner, gate
// contra Cafeone REAL: "el título es más chico". MEDIDO contra el sitio real (fetch directo, no el
// prototipo local): `--font-heading-5-size: clamp(2.0rem,…,2.6rem)` con `html{font-size:62.5%}`
// (1rem=10px ahí) -> ~24px a un viewport de laptop -- ver el docstring de `CartTitulo`.
test("CartTitulo: variante='flotante' -- tamaño de SUBTÍTULO (text-2xl) y peso regular (font-normal), reemplazando font-semibold", () => {
  const html = renderToStaticMarkup(React.createElement<PropsCartTitulo>(CartTitulo, { variante: 'flotante' }));
  assert.equal(html, '<h2 class="font-playfair text-2xl font-normal text-[var(--sf-tinta)]">Tu Carrito</h2>');
  assert.doesNotMatch(html, /font-semibold/, 'flotante no debe conservar el peso semibold de hoy');
  assert.doesNotMatch(html, /text-3xl/, 'flotante ya no debe ser el display grande de MUESTRARIO-CARRITO-COMPOSICION-1');
});

test('CartTitulo: las dos variantes conservan la MISMA fuente de TÍTULO (font-playfair, primera clase) y el MISMO color (--sf-tinta)', () => {
  for (const variante of ['anclado', 'flotante'] as const) {
    const html = renderToStaticMarkup(React.createElement<PropsCartTitulo>(CartTitulo, { variante }));
    assert.match(html, /class="font-playfair /);
    assert.match(html, /text-\[var\(--sf-tinta\)\]/);
  }
});

// ─── El CONTENEDOR del cajón -- por lectura de la fuente (CartDrawer no se puede montar, arriba) ────

test("CartDrawer.tsx: el contenedor del drawer gatea SU className por `carrito.variante === 'flotante'`", () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /carrito\.variante === 'flotante'/);
});

test("CartDrawer.tsx: la rama 'flotante' va pegada a los tres bordes (CARRITO-PEGADO-AL-BORDE-1), sin `h-full`", () => {
  const src = leerFuenteCartDrawer();
  const idxFlotante = src.indexOf("carrito.variante === 'flotante'");
  const idxAnclado = src.indexOf('fixed top-0 right-0 z-50 flex h-full');
  assert.ok(idxFlotante > -1 && idxAnclado > -1);
  const bloqueFlotante = src.slice(idxFlotante, idxAnclado);
  // § CARRITO-PEGADO-AL-BORDE-1 (owner 2026-09-30, "el carrito se siente como flotando", contra Cafeone real):
  // pegado a los tres bordes y sin radio; el alto sigue saliendo de top+bottom.
  assert.match(bloqueFlotante, /top-0 right-0 bottom-0/, 'pegado a los tres bordes, como Cafeone');
  assert.doesNotMatch(bloqueFlotante, /rounded-/, 'sin radio: pegado al borde no se redondea');
  assert.doesNotMatch(bloqueFlotante, /h-full/, 'flotante no debe fijar h-full -- el alto sale de top+bottom, no de una clase de altura');
});

test("CartDrawer.tsx: la rama 'flotante' va sin radio (pegada al borde, CARRITO-PEGADO-AL-BORDE-1), fondo de PÁGINA (no de tarjeta)", () => {
  const src = leerFuenteCartDrawer();
  const idxFlotante = src.indexOf("carrito.variante === 'flotante'");
  const idxAnclado = src.indexOf('fixed top-0 right-0 z-50 flex h-full');
  const bloqueFlotante = src.slice(idxFlotante, idxAnclado);
  assert.match(bloqueFlotante, /bg-\[var\(--sf-fondo\)\]/);
  assert.doesNotMatch(bloqueFlotante, /--sf-tarjeta/, 'flotante no debe usar la superficie de TARJETA -- MEDIDO: el prototipo pinta `--surface-page`, no una superficie de tarjeta');
});

test("CartDrawer.tsx: la rama 'anclado' (el `else` del ternario) sigue byte-idéntica a como estaba antes de esta tanda", () => {
  const src = leerFuenteCartDrawer();
  assert.ok(
    src.includes('"fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col bg-[var(--sf-tarjeta)] shadow-2xl"'),
    'la cadena de clases del cajón "anclado" debe seguir siendo exactamente la de hoy, sin un solo carácter distinto',
  );
});

// § CARRITO-CABECERA-Y-COLORES-NAV-1 -- REEMPLAZA el test de arriba (borrado, no dos assert
// contradictorios en el mismo archivo): el ancho SÍ se toca ahora. La rama `anclado` (Nayoli) sigue
// angosta byte-idéntica -- ya cubierto por el test de arriba ("la rama 'anclado' … sigue byte-
// idéntica"), que afirma la cadena COMPLETA de su className. La rama `flotante` (CORTE) sube a un
// ancho nuevo, MEDIDO contra el cajón REAL de Cafeone (`x-cafeone.myshopify.com`, `--width:53rem` a
// `html{font-size:62.5%}` = 530px exactos -- ver el docstring de la clase en `CartDrawer.tsx`). El
// discriminador es el STRING LITERAL exacto de esa rama -- no el `bloqueFlotante` amplio que usan
// los tests de arriba (ese span arranca en la declaración `const flotante = …`, ANTES del JSX, así
// que también atraviesa los comentarios de esta misma tanda, que citan el nombre de la clase vieja
// al explicar qué NO cambió).
test("CartDrawer.tsx: la rama 'flotante' declara el ancho MEDIDO contra Cafeone real (530px)", () => {
  const src = leerFuenteCartDrawer();
  assert.match(
    src,
    /"fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-\[530px\] flex-col bg-\[var\(--sf-fondo\)\] text-\[var\(--sf-texto\)\] shadow-2xl"/,
    'la cadena de clases de la rama flotante debe declarar el ancho medido contra Cafeone real; w-full se conserva para el teléfono a pantalla completa',
  );
});

test('CartDrawer.tsx: `<CartTitulo variante={carrito.variante}` está cableado dentro del header del drawer', () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /<CartTitulo variante=\{carrito\.variante\}/);
});

// ─── § CARRITO-CABECERA-Y-COLORES-NAV-1 -- la cabecera 'flotante' pierde el ícono, conserva el filete ──

test("CartDrawer.tsx: la cabecera 'flotante' NO renderiza el ícono de bolsa (`ShoppingBag`) -- Cafeone real no lo lleva", () => {
  const src = leerFuenteCartDrawer();
  assert.match(src, /\{!flotante && <ShoppingBag/, 'el ícono debe estar condicionado a `!flotante`');
});

test("CartDrawer.tsx: la cabecera 'anclado' (Nayoli) SIGUE con el ícono de bolsa, sin condición -- byte-idéntico a hoy", () => {
  const src = leerFuenteCartDrawer();
  const idxHeader = src.indexOf('{/* Header */}');
  const idxCierreHeaderDiv = src.indexOf('{/* Items */}');
  const bloqueHeader = src.slice(idxHeader, idxCierreHeaderDiv);
  assert.match(bloqueHeader, /\{!flotante && <ShoppingBag className="h-5 w-5 text-\[var\(--sf-acento-texto\)\]" \/>\}/);
});

test("CartDrawer.tsx: la cabecera conserva el filete inferior (`sf-divisor-b`) en las DOS variantes -- no se tocó", () => {
  const src = leerFuenteCartDrawer();
  const idxHeader = src.indexOf('{/* Header */}');
  const idxCierreHeaderDiv = src.indexOf('{/* Items */}');
  const bloqueHeader = src.slice(idxHeader, idxCierreHeaderDiv);
  assert.match(bloqueHeader, /sf-divisor-b border-\[var\(--sf-linea\)\]/, 'el filete bajo la cabecera debe seguir presente para las dos variantes');
});

// ─── resolverCarrito — el resolver SOFT de la meta ──────────────────────────────────────────────────

test('resolverCarrito: sin nada guardado -> el default (anclado, byte-idéntico)', () => {
  assert.deepEqual(resolverCarrito(undefined, DEFAULTS.carrito), { variante: 'anclado' });
  assert.deepEqual(DEFAULTS.carrito, { variante: 'anclado' });
});

test('resolverCarrito: guardado explícito "flotante" sobrevive', () => {
  assert.deepEqual(resolverCarrito({ variante: 'flotante' }, DEFAULTS.carrito), { variante: 'flotante' });
});

test('resolverCarrito: basura (fuera del set cerrado) cae al default, nunca lanza', () => {
  for (const basura of [null, undefined, 'x', 42, [], { variante: 'volando' }, { variante: 42 }]) {
    assert.deepEqual(resolverCarrito(basura, DEFAULTS.carrito), { variante: 'anclado' });
  }
});

// ─── La meta está en la ALLOWLIST del route (`siteContentEditableSchema`, la MISMA que
// `app/api/site-content/detalles/route.ts` acota con `.pick()`) — sin esto, el schema STRIPPEARÍA
// `carrito` en silencio al guardar (§ CLAUDE.md, el modo de falla del #65-B). ───────────────────────

test('carrito está declarado en siteContentEditableSchema -- no lo strippea al parsear', () => {
  const parsed = siteContentEditableSchema.parse({
    volverArriba: { visible: true },
    rielSocial: { visible: true },
    carritoEnvio: { visible: true },
    carrito: { variante: 'flotante' },
  });
  assert.equal(parsed.carrito?.variante, 'flotante');
});

test('el `.pick({carrito: true})` que usa la ruta propia sigue aceptando y preservando la clave', () => {
  const detallesSchema = siteContentEditableSchema.pick({ volverArriba: true, rielSocial: true, carritoEnvio: true, carrito: true });
  const parsed = detallesSchema.parse({ carrito: { variante: 'flotante' } });
  assert.deepEqual(parsed, { carrito: { variante: 'flotante' } });
});

// ─── El control del panel — huecosDelPanel() sigue en [], el techo del trinquete no sube ───────────

test('carrito.variante tiene control en el panel (DetallesSitioSeccion.tsx)', () => {
  assert.ok(camposControladosPorPanel().includes('carrito.variante'));
});

test('huecosDelPanel(): con la meta nueva (carrito.variante), sigue sin quedar ningún campo sin control', () => {
  assert.deepEqual(huecosDelPanel(), []);
});

// ─── CORTE es el único preset del catálogo que enciende la composición flotante ─────────────────────

test("mergePresetEnContent(_, CORTE).carrito.variante === 'flotante' -- CORTE la enciende", () => {
  const out = mergePresetEnContent({}, CORTE);
  assert.equal((out.carrito as { variante: string }).variante, 'flotante');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// § CARRITO-CABECERA-Y-COLORES-NAV-1 -- StoreNav.tsx: el contador del carrito pasa a `--sf-accion`
// (rojo), y el texto del badge "Cosecha 2026" pasa a blanco (`--sf-acento-txt`)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// `StoreNav.tsx` no se puede montar en el carril -- usa `usePathname()` (`next/navigation`), que
// fuera de un árbol real de Next devuelve `null` (§ `menu-como-dato.test.ts`, el mismo motivo ya
// documentado ahí) -- así que estas dos piezas se afirman por LECTURA DE FUENTE, el mismo mecanismo
// que `leerFuenteCartDrawer()` ya usa arriba en este archivo y que `cta-primario.test.ts` usa para
// el resto de los CTA del storefront.

function leerFuenteStoreNav(): string {
  const srcPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../components/storefront/layout/StoreNav.tsx');
  return readFileSync(srcPath, 'utf8');
}

test('StoreNav.tsx: las DOS copias del contador (desktop + drawer móvil) usan `--sf-accion`/`--sf-accion-txt` cuando `badgeColor` está puesto (CORTE) -- ya no el dorado', () => {
  const src = leerFuenteStoreNav();
  const ocurrencias = src.split('bg-[var(--sf-accion,var(--sf-tostado))] text-[var(--sf-accion-txt,var(--sf-tinta))]').length - 1;
  assert.equal(ocurrencias, 2, 'debe haber EXACTAMENTE dos contadores leyendo el token de ACCIÓN -- desktop y drawer móvil pantallaCompleta');
});

test('StoreNav.tsx: NINGUNA de las DOS copias del contador sigue pintando `bg-[var(--sf-tostado)] text-[var(--sf-tinta)]` para el conteo', () => {
  const src = leerFuenteStoreNav();
  // El discriminador es la combinación EXACTA fondo+texto del contador viejo, como cadena única --
  // `--sf-tostado` y `--sf-tinta` SIGUEN vivos en el archivo por otras razones (el ícono vacío del
  // carrito, el link activo del nav, etc.), así que un `doesNotMatch` suelto sobre cualquiera de los
  // dos por separado daría falso positivo. La pareja unida es la que sólo el contador viejo tenía.
  assert.doesNotMatch(src, /bg-\[var\(--sf-tostado\)\] text-\[var\(--sf-tinta\)\]/, 'ningún contador debe seguir con el par dorado/tinta viejo (y badgeSpan tampoco -- ver el test de abajo)');
});

test('StoreNav.tsx: los DOS contadores siguen gateados por `navTratamiento.badgeColor ?` como ternario propio (mismo gate; sólo cambia a qué apunta)', () => {
  const src = leerFuenteStoreNav();
  // El patrón `identificador + salto de línea + ?` sólo aparece en el TERNARIO de cada contador
  // (desktop y drawer móvil) -- distinto de `navTratamiento.cta && navTratamiento.badgeColor ? {`
  // de `badgeSpan`, que está en UNA sola línea sin salto antes del `?`, y de los comentarios (que no
  // siguen esta forma). `\s*` en vez de un indentado fijo, para no atarse a cuántos espacios exactos
  // separan cada copia.
  const ocurrencias = (src.match(/navTratamiento\.badgeColor\r?\n\s*\?/g) ?? []).length;
  assert.equal(ocurrencias, 2, 'debe haber EXACTAMENTE dos contadores con su propio ternario gateado por badgeColor -- desktop y drawer móvil pantallaCompleta');
});

test('StoreNav.tsx: ninguno de los DOS contadores sigue pisando `backgroundColor` con el hex de `badgeColor` -- el color ahora sale del token, no de un hex inline', () => {
  const src = leerFuenteStoreNav();
  // `backgroundColor: navTratamiento.badgeColor` sigue vivo UNA vez -- el `style` de `badgeSpan`
  // (el fondo del badge "Cosecha", que NO se tocó). Los DOS contadores ya no lo usan.
  const ocurrencias = src.split('backgroundColor: navTratamiento.badgeColor').length - 1;
  assert.equal(ocurrencias, 1, 'sólo badgeSpan debe seguir pisando backgroundColor con el hex -- los contadores ya resuelven el color por el token');
});

test('StoreNav.tsx: badgeSpan (el badge "Cosecha 2026") pinta su texto con `--sf-acento-txt` cuando `navTratamiento.cta` está encendido (CORTE) -- ya no `--sf-tinta`', () => {
  const src = leerFuenteStoreNav();
  assert.match(src, /navTratamiento\.cta \? 'bg-\[var\(--sf-tostado\)\] text-\[var\(--sf-acento-txt\)\]'/, 'el fondo dorado se conserva; sólo el texto pasa a --sf-acento-txt');
});

test('StoreNav.tsx: badgeSpan ya NO pinta el texto de "Cosecha" con `--sf-tinta` bajo `navTratamiento.cta`', () => {
  const src = leerFuenteStoreNav();
  assert.doesNotMatch(src, /navTratamiento\.cta \? 'bg-\[var\(--sf-tostado\)\] text-\[var\(--sf-tinta\)\]'/, 'el texto del badge de cosecha no debe seguir en --sf-tinta bajo el tratamiento CORTE');
});

test('StoreNav.tsx: badgeSpan sigue pisando el FONDO con el hex de `badgeColor` (sin cambio) -- sólo el texto se movió', () => {
  const src = leerFuenteStoreNav();
  assert.match(src, /style=\{navTratamiento\.cta && navTratamiento\.badgeColor \? \{ backgroundColor: navTratamiento\.badgeColor \} : undefined\}/);
});
