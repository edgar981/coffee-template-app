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
  productosBandaMarquesina,
  MAX_PRODUCTOS_BANDA_MARQUESINA,
  type SiteContentData,
} from './site-content-defaults';
import { CORTE, PATIO, mergePresetEnContent, validarPreset, presetCompleto } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

// MARQUESINA-BANDA-1 (medido: MARQUESINA-BANDA-CENSO-1), REHECHA por § EDITOR-TIENDA-MARQUESINA-
// SECCION-1 — ya no es la forma "Cafeone" (foto velada + UN texto por scroll + UNA tarjeta que
// escala/rota): usa el MISMO motor que el hero·sticky (`MarquesinaMotor.tsx`), generalizado a HASTA
// SEIS productos que se van reemplazando uno al otro a medida que se hace scroll. `marquesina` sigue
// siendo miembro de `BANDA_IDS`, 2ª tras `hero` — coexiste con `featured`/`spotlight`.
//
// Este archivo afirma: el modelo (REGISTRY/DEFAULTS, los tres campos de SIEMPRE Y los seis nuevos);
// el gate de visibilidad (nace OFF); el cableado del preset (CORTE la apaga, PATIO no la toca, sin
// cambios — § CORTE-USA-HERO-STICKY-1 no se tocó en esta ronda); la resolución de la lista de
// productos (`productosBandaMarquesina`); y el render — SIN catálogo real (SSR, mismo límite que
// `hero-marquesina.test.ts`) la frase SIEMPRE rinde (hide-on-empty es de la LISTA, no de la
// sección) y la tarjeta/el escenario de productos NO, porque no hay nada que mostrar todavía.

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

test('DEFAULTS.marquesina: `texto`/`imagen`/`fraseBanda` tienen valor (REQUERIDOS); `productoSlug` y los seis `producto1..6` nacen VACÍOS', () => {
  assert.notEqual(DEFAULTS.marquesina.texto.trim(), '');
  assert.notEqual(DEFAULTS.marquesina.imagen.trim(), '');
  assert.notEqual(DEFAULTS.marquesina.fraseBanda.trim(), '');
  assert.equal(DEFAULTS.marquesina.productoSlug, '');
  for (let i = 1; i <= 6; i++) {
    assert.equal((DEFAULTS.marquesina as unknown as Record<string, string>)[`producto${i}`], '');
  }
});

test('DEFAULTS.marquesina.fraseBanda es DISTINTA de `texto` — la banda suelta y el hero no comparten frase', () => {
  assert.notEqual(DEFAULTS.marquesina.fraseBanda, DEFAULTS.marquesina.texto);
});

test('DEFAULTS.marquesina.imagenTipo es "imagen" — la canónica, byte-idéntica sin fila', () => {
  assert.equal(DEFAULTS.marquesina.imagenTipo, 'imagen');
});

test('REGISTRY.marquesina: ocultable, sin variantes, sin repeater, con el campo-imagen declarado para el borrado de blobs', () => {
  assert.equal(REGISTRY.marquesina.ocultable, true);
  assert.equal(REGISTRY.marquesina.variantes, undefined);
  assert.equal(REGISTRY.marquesina.repeater, undefined);
  assert.deepEqual(REGISTRY.marquesina.imagenes, ['imagen']);
});

test('REGISTRY.marquesina: `texto`/`imagen`/`fraseBanda` son requeridos; `productoSlug` y `producto1..6` son opcionales', () => {
  const c = REGISTRY.marquesina.campos;
  assert.equal(c.texto, 'requerido');
  assert.equal(c.imagen, 'requerido');
  assert.equal(c.fraseBanda, 'requerido');
  assert.equal(c.productoSlug, 'opcional');
  for (let i = 1; i <= 6; i++) assert.equal(c[`producto${i}`], 'opcional');
});

test('REGISTRY.marquesina.escalares: dos escalares — imagenTipo ["imagen","video"]/"imagen" y transicion (las cinco)/"subir"', () => {
  assert.deepEqual(REGISTRY.marquesina.escalares, {
    imagenTipo: { claves: ['imagen', 'video'], canonica: 'imagen' },
    transicion: { claves: ['subir', 'deslizar', 'acercar', 'enfocar', 'girar'], canonica: 'subir' },
  });
});

// ─── EDITOR-TIENDA-MARQUESINA-TRANSICIONES-1 — el escalar `transicion` ───────────────────────────

test('DEFAULTS.marquesina.transicion es "subir" — la canónica, byte-idéntica sin fila (la entrada de hoy)', () => {
  assert.equal(DEFAULTS.marquesina.transicion, 'subir');
});

test('resolverSiteContent: `transicion` guardada se respeta para cada una de las cinco; basura cae a la canónica "subir"', () => {
  for (const t of ['subir', 'deslizar', 'acercar', 'enfocar', 'girar']) {
    assert.equal(resolverSiteContent({ marquesina: { transicion: t } }).marquesina.transicion, t);
  }
  assert.equal(resolverSiteContent({ marquesina: { transicion: 'basura' } }).marquesina.transicion, 'subir');
  assert.equal(resolverSiteContent({}).marquesina.transicion, 'subir');
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

test('resolverSiteContent: `imagenTipo` guardado "video" se respeta; basura cae a la canónica "imagen"', () => {
  assert.equal(resolverSiteContent({ marquesina: { imagenTipo: 'video' } }).marquesina.imagenTipo, 'video');
  assert.equal(resolverSiteContent({ marquesina: { imagenTipo: 'basura' } }).marquesina.imagenTipo, 'imagen');
});

test('resolverSiteContent: los seis `producto1..6` guardados se respetan, en orden, sin tocarse entre sí', () => {
  const resuelto = resolverSiteContent({ marquesina: { producto1: 'a', producto3: 'c', producto6: 'f' } });
  assert.equal(resuelto.marquesina.producto1, 'a');
  assert.equal(resuelto.marquesina.producto2, '');
  assert.equal(resuelto.marquesina.producto3, 'c');
  assert.equal(resuelto.marquesina.producto6, 'f');
});

// ─── LA LISTA DE PRODUCTOS — `productosBandaMarquesina` ──────────────────────────────────────────

const CATALOGO = [
  { slug: 'uno' }, { slug: 'dos' }, { slug: 'tres' }, { slug: 'cuatro' },
  { slug: 'cinco' }, { slug: 'seis' }, { slug: 'siete' },
] as const;

test('productosBandaMarquesina: los seis slots vacíos (o un catálogo vacío) caen al CATÁLOGO, en SU orden, hasta el tope — es una VITRINA, no un pin', () => {
  const r = productosBandaMarquesina(CATALOGO, ['', '', '', '', '', '']);
  assert.deepEqual(r.map((p) => p.slug), ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis']);
  assert.equal(r.length, MAX_PRODUCTOS_BANDA_MARQUESINA);
});

test('productosBandaMarquesina: con slugs elegidos, resuelve EN SU ORDEN — nunca el orden del catálogo', () => {
  const r = productosBandaMarquesina(CATALOGO, ['tres', 'uno', '', '', '', '']);
  assert.deepEqual(r.map((p) => p.slug), ['tres', 'uno']);
});

test('productosBandaMarquesina: un slug que NO matchea ningún producto se FILTRA — nunca cae a un producto arbitrario', () => {
  const r = productosBandaMarquesina(CATALOGO, ['no-existe', 'dos', '', '', '', '']);
  assert.deepEqual(r.map((p) => p.slug), ['dos']);
});

test('productosBandaMarquesina: TODOS los slugs rotos o vacíos → cae al catálogo igual que la lista vacía', () => {
  const r = productosBandaMarquesina(CATALOGO, ['no-existe', 'tampoco', '', '', '', '']);
  assert.deepEqual(r.map((p) => p.slug), ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis']);
});

test('productosBandaMarquesina: catálogo vacío → lista vacía (hide-on-empty del escenario, no hay nada que mostrar)', () => {
  assert.deepEqual(productosBandaMarquesina([], ['uno', 'dos', '', '', '', '']), []);
});

test('productosBandaMarquesina: la elegida se recorta al tope aunque se pasen más de seis slugs', () => {
  const r = productosBandaMarquesina(CATALOGO, ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete']);
  assert.equal(r.length, MAX_PRODUCTOS_BANDA_MARQUESINA);
});

// ─── EL RENDER — LA INVARIANTE: Nayoli queda BYTE-IDÉNTICA ─────────────────────────────────────

test('LA INVARIANTE: Nayoli (resolverSiteContent({}), sin fila) rinde la banda VACÍA — ni un nodo', () => {
  const html = renderMarquesina(resolverSiteContent({}));
  assert.equal(html, '');
});

test('con `marquesina.visible:true` y los DEFAULTS (sin productos configurados, SIN catálogo real en SSR): la FRASE rinde igual — hide-on-empty es de la LISTA, no de la sección', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content);
  assert.ok(html !== '');
  assert.ok(html.includes(DEFAULTS.marquesina.fraseBanda), 'la frase propia de la banda debe rendir');
  assert.ok(!html.includes(DEFAULTS.marquesina.texto), 'el texto del HERO no debe aparecer en la banda suelta — son campos distintos');
  assert.ok(!html.includes('sf-radio-tile'), 'sin catálogo real en SSR, ninguna tarjeta de producto debe rendir todavía');
});

test('la frase rinde DOS VECES dentro del track (la cinta continua) MÁS la 3ª aparición del `aria-label` de la sección', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content);
  const apariciones = html.split(DEFAULTS.marquesina.fraseBanda).length - 1;
  assert.equal(apariciones, 3);
});

test('visible:true SIN scroll real (SSR, progreso=0): la sección pineada rinde `sticky`, no el layout estático', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content);
  assert.ok(html.includes('sticky'), 'fuera de preview/reduced-motion, el motor sticky debe montarse');
});

test('EN PREVIEW (proxy de movimiento reducido): layout ESTÁTICO, sin `sticky` — todos los productos visibles a la vez, sin animación', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content, { preview: true });
  assert.ok(!html.includes('sticky'), 'en preview no hay scroll que revelar, así que no hay sticky');
  assert.ok(html.includes(DEFAULTS.marquesina.fraseBanda));
});

test('imagenTipo "imagen" (default): el fondo es una <Image> (next/image, srcset) — nunca un <video>', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content);
  assert.ok(!html.includes('<video'));
});

test('imagenTipo "video": el fondo es un <video muted loop playsInline>, con la MISMA imagen como src', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true, imagenTipo: 'video' as const } } as SiteContentData;
  const html = renderMarquesina(content);
  assert.ok(html.includes('<video'));
  assert.ok(html.includes(`src="${DEFAULTS.marquesina.imagen}"`));
});

// ─── CORTE la APAGA (§ CORTE-USA-HERO-STICKY-1); los demás presets no tocan `content.marquesina` ─
//
// SIN CAMBIOS en esta ronda: CORTE sigue apagando la banda suelta porque el hero·sticky ya muestra
// su propio texto/pin (`marquesina.texto`/`.productoSlug`, intactos) — este slice no tocó `themes.ts`
// ni esa decisión.

test('CORTE declara bandasVisibles.marquesina:false (§ CORTE-USA-HERO-STICKY-1, era true) y NO le asigna esquema propio — sigue validando COMPLETO', () => {
  assert.equal(CORTE.bandasVisibles?.marquesina, false);
  assert.equal(CORTE.esquemas.marquesina, undefined);
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('mergePresetEnContent(_, CORTE): APAGA marquesina.visible — su contenido ya rinde dentro del hero·sticky, dejarla encendida lo duplicaría', () => {
  const despues = mergePresetEnContent({ ...DEFAULTS }, CORTE);
  const marquesina = despues.marquesina as Record<string, unknown>;
  assert.equal(marquesina.visible, false);
});

test('mergePresetEnContent(_, CORTE): preserva cualquier copy/pin que el dueño ya hubiera puesto, sólo apaga `visible`', () => {
  const antes = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, texto: 'Mi propio texto', fraseBanda: 'Mi propia frase', productoSlug: 'mi-slug' } };
  const despues = mergePresetEnContent(antes as unknown as Record<string, unknown>, CORTE);
  const marquesina = despues.marquesina as Record<string, unknown>;
  assert.equal(marquesina.visible, false);
  assert.equal(marquesina.texto, 'Mi propio texto');
  assert.equal(marquesina.fraseBanda, 'Mi propia frase');
  assert.equal(marquesina.productoSlug, 'mi-slug');
});

test('mergePresetEnContent NO toca marquesina para un preset que NO declara bandasVisibles.marquesina (PATIO)', () => {
  assert.equal(PATIO.bandasVisibles?.marquesina, undefined);
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

// § CORTE-USA-HERO-STICKY-1: bajo el hero·sticky, la banda suelta queda apagada — su texto/pin ya no
// rinden AQUÍ, sino dentro del hero (§ `hero-marquesina.test.ts`).
test('?tema=CORTE sobre Nayoli: la banda suelta queda APAGADA — no renderiza nada (su contenido ya vive dentro del hero·sticky)', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.marquesina.visible, false);
  assert.equal(renderMarquesina(conCorte), '');
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
  assert.equal(conCorte.marquesina.fraseBanda, nayoli.marquesina.fraseBanda);
  assert.equal(conCorte.marquesina.imagen, nayoli.marquesina.imagen);
  assert.equal(conCorte.marquesina.productoSlug, nayoli.marquesina.productoSlug);
});
