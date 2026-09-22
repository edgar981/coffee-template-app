import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import Marquesina from '@/components/storefront/home/Marquesina';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';

import {
  BANDA_IDS,
  BANDAS_OSCURAS,
  DEFAULTS,
  REGISTRY,
  resolverSiteContent,
  seccionEsVisible,
  type SiteContentData,
} from './site-content-defaults';
import { CORTE, PATIO, mergePresetEnContent, validarPreset, presetCompleto } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

// MARQUESINA-BANDA-1 (medido: MARQUESINA-BANDA-CENSO-1) — tres capas: foto de fondo velada + un
// LOOP de texto a gran escala + una tarjeta de producto flotante (el PIN de spotlight reusado). A
// DIFERENCIA de spotlight (variante de `featured`), `marquesina` ES miembro de `BANDA_IDS`, 2ª tras
// `hero` — coexiste con `featured`/`spotlight`, no lo reemplaza (§ MARQUESINA-BANDA-CENSO-1: son tres
// secciones distintas del prototipo). Este archivo afirma el modelo (REGISTRY/DEFAULTS), el gate de
// visibilidad, el cableado del preset (CORTE la enciende, PATIO no la toca), el render por
// `renderToStaticMarkup` (sin jsdom, § CLAUDE.md) — incluida la mitad verificable del scroll (el
// gate estático; el `useScroll` real es capa 3, mismo límite que `historia-direccion-arte.test.ts`
// documenta para el otro motor de movimiento) — y el pin del producto (reuso de `productoSpotlight`).

function renderMarquesina(content: SiteContentData, opts: { preview?: boolean } = {}): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(Marquesina) });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

// ─── EL MODELO ──────────────────────────────────────────────────────────────────────────────────

test('marquesina ES miembro de BANDA_IDS (a diferencia de spotlight), 2ª posición, justo tras `hero`', () => {
  assert.equal((BANDA_IDS as readonly string[]).includes('marquesina'), true);
  assert.equal(BANDA_IDS[0], 'hero');
  assert.equal(BANDA_IDS[1], 'marquesina');
});

test('marquesina ES canónicamente OSCURA (§ BANDAS_OSCURAS) — su fondo es la foto velada + overlay de tinta', () => {
  assert.equal(BANDAS_OSCURAS.has('marquesina'), true);
});

test('DEFAULTS.marquesina nace OFF (visible:false) — la banda no se enciende sola', () => {
  assert.equal(DEFAULTS.marquesina.visible, false);
});

test('DEFAULTS.marquesina: `texto`/`imagen` tienen valor (REQUERIDOS); `productoSlug` nace VACÍO (sin pin)', () => {
  assert.notEqual(DEFAULTS.marquesina.texto.trim(), '');
  assert.notEqual(DEFAULTS.marquesina.imagen.trim(), '');
  assert.equal(DEFAULTS.marquesina.productoSlug, '');
});

test('REGISTRY.marquesina: ocultable, sin variantes, sin repeater, con el campo-imagen declarado para el borrado de blobs', () => {
  assert.equal(REGISTRY.marquesina.ocultable, true);
  assert.equal(REGISTRY.marquesina.variantes, undefined);
  assert.equal(REGISTRY.marquesina.repeater, undefined);
  assert.deepEqual(REGISTRY.marquesina.imagenes, ['imagen']);
});

test('REGISTRY.marquesina: `texto`/`imagen` son requeridos; `productoSlug` es opcional', () => {
  const c = REGISTRY.marquesina.campos;
  assert.equal(c.texto, 'requerido');
  assert.equal(c.imagen, 'requerido');
  assert.equal(c.productoSlug, 'opcional');
});

test('sin fila (Nayoli), marquesina resuelve OFF — DEFAULTS y el gate coinciden', () => {
  const resuelto = resolverSiteContent({});
  assert.deepEqual(resuelto.marquesina, DEFAULTS.marquesina);
  assert.equal(seccionEsVisible(REGISTRY.marquesina, resuelto.marquesina), false);
});

test('con visible explícito en true, la sección deja de ocultarse — la garantía de arriba es del DEFAULT, no de un `ocultable:false`', () => {
  const resuelto = resolverSiteContent({ marquesina: { visible: true } });
  assert.equal(resuelto.marquesina.visible, true);
  assert.equal(seccionEsVisible(REGISTRY.marquesina, resuelto.marquesina), true);
});

// ─── EL RENDER — LA INVARIANTE: Nayoli queda BYTE-IDÉNTICA ─────────────────────────────────────

test('LA INVARIANTE: Nayoli (resolverSiteContent({}), sin fila) rinde la banda VACÍA — ni un nodo', () => {
  const html = renderMarquesina(resolverSiteContent({}));
  assert.equal(html, '');
});

test('con `marquesina.visible:true` y los DEFAULTS (sin pin): rinde el texto del loop, pero SIN la tarjeta — hide-on-empty de la tarjeta, no de la sección', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content);
  assert.ok(html !== '');
  assert.ok(html.includes(DEFAULTS.marquesina.texto), 'el texto del loop debe rendir aunque no haya pin');
  assert.ok(!/aspect-\[3\/4\]/.test(html), 'sin pin (catálogo vacío en SSR), la tarjeta flotante no debe rendir');
});

test('el texto del loop rinde DOS VECES dentro del track (el efecto de cinta continua, § `.marquee-track` del prototipo) — MÁS la 3ª aparición del `aria-label` de la sección', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content);
  // 3 = las 2 del loop (`<span class="pr-8">…`) + 1 del `aria-label` de la <section> (el nombre
  // accesible, para que el lector de pantalla anuncie la frase una vez — el loop visual es
  // `aria-hidden`). Un total de 2 significaría que el `aria-label` se perdió; de 1, que el loop dejó
  // de duplicarse.
  const apariciones = html.split(DEFAULTS.marquesina.texto).length - 1;
  assert.equal(apariciones, 3);
  const enSpans = (html.match(/<span class="pr-8">/g) || []).length;
  assert.equal(enSpans, 2, 'el loop debe repetir el texto en exactamente DOS <span>');
});

// ─── EL SCROLL — el gate ESTÁTICO (§ lib/animation.test.ts para la matemática pura) ──────────────
//
// LO QUE SE PUEDE AFIRMAR SIN NAVEGADOR (mismo límite que `historia-direccion-arte.test.ts`): el
// PROXY de movimiento reducido es la VISTA PREVIA (`PreviewProvider`) — las dos razones colapsan al
// MISMO `estatico` en `Marquesina.tsx`, así que ejercer una prueba la otra. `prefers-reduced-motion`
// en tiempo real depende de `matchMedia`, que no existe en este carril.

test('EN PREVIEW (proxy de movimiento reducido): el texto queda CENTRADO y QUIETO — sin desplazamiento horizontal', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content, { preview: true });
  assert.ok(html.includes('transform:translateY(-50%)'), 'el texto debe rendir su transform QUIETO bajo el gate estático');
  assert.ok(!/translate\(-?\d/.test(html), 'ningún transform de desplazamiento horizontal debe sobrevivir bajo el gate estático');
});

test('SIN el gate estático (SSR, sin scroll real: progreso arranca en 0) — el texto arranca SIN desplazamiento (progreso=0 → -0*travel=0)', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content);
  assert.ok(html.includes('transform:translate(0.0px, -50%)'), 'a progreso=0, sin el gate estático, el texto no debe desplazarse todavía');
  assert.ok(!html.includes('transform:translateY(-50%)'), 'sin el gate estático, el texto NO debe rendir la forma "quieta"');
});

// ─── CORTE la enciende; los demás presets no tocan `content.marquesina` ─────────────────────────

test('CORTE declara bandaMarquesinaVisible y NO le asigna esquema propio (fondo por canónica oscura) — sigue validando COMPLETO', () => {
  assert.equal(CORTE.bandaMarquesinaVisible, true);
  assert.equal(CORTE.esquemas.marquesina, undefined);
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('mergePresetEnContent(_, CORTE): enciende marquesina.visible — si no, el slot quedaría en el orden y en blanco', () => {
  const despues = mergePresetEnContent({ ...DEFAULTS }, CORTE);
  const marquesina = despues.marquesina as Record<string, unknown>;
  assert.equal(marquesina.visible, true);
});

test('mergePresetEnContent(_, CORTE): preserva cualquier copy/pin que el dueño ya hubiera puesto, sólo enciende `visible`', () => {
  const antes = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, texto: 'Mi propio texto', productoSlug: 'mi-slug' } };
  const despues = mergePresetEnContent(antes as unknown as Record<string, unknown>, CORTE);
  const marquesina = despues.marquesina as Record<string, unknown>;
  assert.equal(marquesina.visible, true);
  assert.equal(marquesina.texto, 'Mi propio texto');
  assert.equal(marquesina.productoSlug, 'mi-slug');
});

test('mergePresetEnContent NO toca marquesina para un preset que NO declara bandaMarquesinaVisible (PATIO)', () => {
  assert.equal(PATIO.bandaMarquesinaVisible, undefined);
  const despues = mergePresetEnContent({ ...DEFAULTS }, PATIO);
  assert.deepEqual(despues.marquesina, DEFAULTS.marquesina);
});

// ─── EL MIRADOR (`?tema=CORTE`) — la vista de sólo-lectura que ejerce la cadena completa ─────────

test('sin ?tema= (mirador con clave undefined): Nayoli no cambia — marquesina sigue sin renderizar', () => {
  const nayoli = resolverSiteContent({});
  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli);
  assert.equal(renderMarquesina(sinTema), '');
});

test('?tema=CORTE sobre Nayoli: marquesina pasa a visible y el render trae el texto de los DEFAULTS (Nayoli no tiene fila propia; mergePresetEnContent nunca escribe texto de sección)', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.marquesina.visible, true);

  const html = renderMarquesina(conCorte);
  assert.ok(html !== '');
  assert.ok(html.includes(DEFAULTS.marquesina.texto));
  // Consecuencia MEDIDA y aceptada (§ el docstring de `MarquesinaContent`): sin panel para cargar un
  // pin real, la tarjeta flotante rinde vacía bajo CORTE — mismo comportamiento que `featured·
  // spotlight` hoy sin catálogo real (§ spotlight-cableado.test.ts) y que `origen` sin datos
  // (§ origen-banda.test.ts).
  assert.ok(!/aspect-\[3\/4\]/.test(html), 'sin catálogo real, la tarjeta flotante no rinde ni bajo CORTE');
});

test('marquesina es la 2ª banda en el orden resuelto bajo CORTE — justo tras `hero`', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.orden[0], 'hero');
  assert.equal(conCorte.orden[1], 'marquesina');
});

test('?tema=CORTE NO toca ningún texto/dato de la sección — sólo `visible` (coherente con la garantía general del mirador)', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.marquesina.texto, nayoli.marquesina.texto);
  assert.equal(conCorte.marquesina.imagen, nayoli.marquesina.imagen);
  assert.equal(conCorte.marquesina.productoSlug, nayoli.marquesina.productoSlug);
});
