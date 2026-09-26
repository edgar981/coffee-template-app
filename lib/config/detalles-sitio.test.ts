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
} from '@/components/storefront/CartDrawer';
import { formatCOP } from '@duna/core/utils';
import { DEFAULTS, resolverCarritoEnvio } from './site-content-defaults';
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
