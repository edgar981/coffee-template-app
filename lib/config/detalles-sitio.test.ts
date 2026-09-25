import { test } from 'node:test';
import assert from 'node:assert/strict';
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
