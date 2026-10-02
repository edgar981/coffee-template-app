import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import GrindChooserRiel, { TarjetaRiel } from '@/components/storefront/home/GrindChooserRiel';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { CartProvider } from '@/lib/cartStore';
import type { Product } from '@/types/product';
import { resolverSiteContent } from './site-content-defaults';

// RIEL-SCROLL-Y-BADGE-DORADO-1 — el TRACK ("Elige tu presentación", composición 'riel') dejaba de
// scrollear la página cuando el cursor quedaba sobre la tarjeta resaltada. MEDIDO (no supuesto,
// contra una reproducción fiel de las clases Tailwind computadas de este track, con Playwright real
// — el asiento de DECISIONS.md trae la corrida): `overflow-x-auto` fuerza, por regla de la
// especificación CSS, que `overflow-y` se compute como `auto` en vez de `visible`; la tarjeta
// RESALTADA (`sm:scale-[1.06]`) desbordaba su caja de layout ~6% por los cuatro lados vía `transform`
// — un desborde de PINTADO, no de layout, que SÍ contaba para el `scrollHeight` del contenedor con
// overflow no-visible. El fix (`sm:py-6` en el track) reserva ese espacio. § RIEL-PRODUCTOS-Y-VISTA-
// RAPIDA-1 (2026-09-30) retiró el RESALTADO que causaba el desborde (`useIndiceCentrado`, § lib/
// animation.ts) — `sm:py-6` se conserva como respiro visual del track, sin el defecto que lo motivó.
//
// ESTE CARRIL ES LO AFIRMABLE SIN DOM (§ CLAUDE.md, "el glob NO incluye *.test.tsx" — no hay jsdom):
// `renderToStaticMarkup` no ejecuta layout ni efectos. `GrindChooserRiel` fuente sus tarjetas de
// `getCatalog()` (un `fetch` en un `useEffect`), así que bajo este arnés el catálogo SIEMPRE queda
// `[]` y NINGUNA tarjeta llega a renderizarse — el mismo límite ya documentado para Spotlight/
// Marquesina en `admin-tienda-preset.test.ts`. Lo que SÍ es afirmable sin catálogo es la cáscara del
// componente (cabecera, track, controles) y, por separado, `TarjetaRiel` — extraída exactamente para
// eso (§ su docstring en GrindChooserRiel.tsx) — con un producto de fixture, sin fetch ni catálogo.

function renderRiel(): string {
  const content = resolverSiteContent({});
  const arbol = React.createElement(
    SiteContentProvider,
    { value: content, children: React.createElement(CartProvider, { children: React.createElement(GrindChooserRiel) }) },
  );
  return renderToStaticMarkup(arbol);
}

function claseDelTrack(html: string): string {
  const m = html.match(/class="([^"]*grind-riel-track[^"]*)"/);
  assert.ok(m, 'el track (className con "grind-riel-track") debe estar presente en el render');
  return m![1];
}

test('el track del riel sigue declarando el scroll horizontal + snap de siempre (no se tocan)', () => {
  const clase = claseDelTrack(renderRiel());
  assert.match(clase, /\boverflow-x-auto\b/);
  assert.match(clase, /\bsnap-x\b/);
  assert.match(clase, /\bsnap-mandatory\b/);
});

test('el track gana la reserva vertical del fix (sm:py-6) — el mismo valor medido contra Chromium real (§ DECISIONS.md)', () => {
  const clase = claseDelTrack(renderRiel());
  assert.match(clase, /\bsm:py-6\b/);
});

// La prohibición de `overflow-y-hidden` de arriba (hoy abajo) nació para que la tarjeta RESALTADA
// (`sm:scale-[1.06]`, § RIEL-SCROLL-Y-BADGE-DORADO-1) no se recortara verticalmente — y ese
// resaltado SE RETIRÓ (§ RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1, `useIndiceCentrado`). La regla cambió de
// signo por una causa DISTINTA y nueva (§ RIEL-SIN-SCROLL-VERTICAL-1): `overflow-x-auto` computa
// `overflow-y: auto` por regla de la especificación CSS, y una tarjeta aún no entrada a la vista
// (`whileInView`/`fadeUp`, trasladada 24px por `transform`) extiende el `scrollHeight` del track —
// MEDIDO (Playwright WebKit "iPhone 15"): 505−489 = 16px de scroll vertical propio, en reposo sobre
// la tarjeta 0. Ese scroll vertical es lo que el dedo mueve por deriva al deslizar horizontalmente,
// y Safari lo rebota — el "rebote hacia arriba" que el owner reportó. El track ahora DECLARA
// `overflow-y-hidden` para quitar esa capacidad de scroll sin tocar el pintado (`auto` ya recortaba
// igual que `hidden`).
test('el track declara `overflow-y-hidden` — cierra el scroll vertical propio que Safari rebotaba (§ RIEL-SIN-SCROLL-VERTICAL-1)', () => {
  const clase = claseDelTrack(renderRiel());
  assert.match(clase, /\boverflow-y-hidden\b/);
});

test('LA INVARIANTE: Nayoli no monta esta composición — resolverSiteContent({}) no elige "riel" para presentaciones (sólo CORTE lo pide, vía GrindChooser)', () => {
  const content = resolverSiteContent({});
  assert.notEqual(content.presentaciones?.variante, 'riel');
});

test('bajo Nayoli (sin catálogo, SSR) GrindChooserRiel no revienta — cero tarjetas, no un crash', () => {
  const html = renderRiel();
  assert.ok(html.length > 0, 'debe rendir markup (la cabecera y el track), no tirar');
  assert.doesNotMatch(html, /aspect-\[3\/4\]/, 'sin catálogo (SSR nunca corre el fetch) no hay tarjetas que renderizar');
});

// ─── PARIDAD-RIEL-TARJETAS-1 — los controles de avance viven DESPUÉS del track ────────────────────

test('los controles de avance viven DESPUÉS del track (abajo), no en la cabecera (arriba) — MEDIDO contra `.car-nav`, `css/app.css:553-559` y `index.html:241-246`', () => {
  const html = renderRiel();
  const indiceTrack = html.indexOf('grind-riel-track');
  const indiceFlechaAnterior = html.indexOf('aria-label="Presentación anterior"');
  assert.ok(indiceTrack > -1, 'el track debe estar presente');
  assert.ok(indiceFlechaAnterior > -1, 'el botón "Presentación anterior" debe estar presente');
  assert.ok(
    indiceFlechaAnterior > indiceTrack,
    'las flechas deben aparecer DESPUÉS del track en el HTML — abajo, no en la cabecera',
  );
});

// ─── RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1 — `TarjetaRiel` con un producto de fixture ───────────────────

const PRODUCTO_FIXTURE: Product = {
  id: 'p1',
  nombre: 'Café Nariño 500g',
  slug: 'cafe-narino-500g',
  categoria: 'Café en Grano',
  precio: 35000,
  costo: 0,
  sku: null,
  stock: 10,
  activo: true,
  descripcion: 'Un café de especialidad, tostado con cuidado.',
  imagen: '/a.webp',
  imagenes: ['/b.webp'],
  disponible: true,
};

function renderTarjeta(producto: Product = PRODUCTO_FIXTURE, navHoverClase = 'hover:underline'): string {
  return renderToStaticMarkup(
    React.createElement(TarjetaRiel, {
      producto,
      negocio: undefined,
      navHoverClase,
      preview: false,
      index: 0,
      onEye: () => {},
      onCart: () => {},
    }),
  );
}

test('TarjetaRiel: el tile usa el token de FORMA `sf-radio-tile` con `object-cover`, sin relleno — REVIERTE `object-contain`/`p-6` (§ FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1)', () => {
  const html = renderTarjeta();
  assert.match(html, /aspect-\[3\/4\] overflow-hidden sf-radio-tile bg-\[var\(--sf-linea\)\]/);
  assert.match(html, /object-cover/);
  assert.doesNotMatch(html, /object-contain/);
  assert.doesNotMatch(html, /\bp-6\b/);
  assert.doesNotMatch(html, /rounded-3xl/);
});

test('TarjetaRiel: el precio es el del PRODUCTO, exacto — nunca "Desde"', () => {
  const html = renderTarjeta();
  assert.match(html, /35\.000/, 'debe mostrar el precio formateado del producto ($ 35.000, es-CO)');
  assert.doesNotMatch(html, /Desde/);
});

test('TarjetaRiel: sin foto de atrás (una sola imagen), sólo se renderiza UNA <img> — sin la segunda ni sus clases de crossfade', () => {
  const html = renderTarjeta({ ...PRODUCTO_FIXTURE, imagenes: [] });
  const imgs = html.match(/<img\b/g) ?? [];
  assert.equal(imgs.length, 1, 'sin foto de atrás debe haber UNA sola <img> (la portada), no dos');
  // El `alt=""` es exclusivo de la foto de atrás (la portada lleva el nombre del producto como alt).
  assert.doesNotMatch(html, /alt=""/);
  assert.doesNotMatch(html, /object-cover opacity-0/, 'sin foto de atrás no debe declararse su clase de crossfade');
});

test('TarjetaRiel: CON foto de atrás, hay DOS <img> — la portada se apaga al hover y al FOCO DE TECLADO (§ VISTA-RAPIDA-CENTRADA-1, group-has-[:focus-visible], no group-focus-within)', () => {
  const html = renderTarjeta();
  const imgs = html.match(/<img\b/g) ?? [];
  assert.equal(imgs.length, 2, 'con foto de atrás debe haber DOS <img>: la portada y la de atrás');
  assert.match(html, /object-cover transition-opacity duration-500 group-hover:opacity-0 group-has-\[:focus-visible\]:opacity-0/, 'la portada debe declarar su fade-out al hover y al foco de teclado');
  assert.match(html, /object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-has-\[:focus-visible\]:opacity-100/, 'la foto de atrás debe declarar su fade-in al hover y al foco de teclado');
  assert.doesNotMatch(html, /group-focus-within/, 'group-focus-within reacciona al foco programático que deja el modal al cerrar — el defecto que VISTA-RAPIDA-CENTRADA-1 cierra');
});

test('TarjetaRiel: las dos acciones rápidas (ojo y carrito) están presentes, y el carrito se OMITE si el producto no está disponible', () => {
  const conStock = renderTarjeta();
  assert.match(conStock, /Vista rápida de Café Nariño 500g/);
  assert.match(conStock, /Agregar Café Nariño 500g al carrito/);

  const sinStock = renderTarjeta({ ...PRODUCTO_FIXTURE, disponible: false });
  assert.match(sinStock, /Vista rápida de Café Nariño 500g/, 'el ojo sigue disponible aunque no haya stock');
  assert.doesNotMatch(sinStock, /Agregar Café Nariño 500g al carrito/, 'sin stock no se ofrece agregar directo');
});

test('TarjetaRiel: el nombre vive en un `<span>` DENTRO del `<h3>` (§ RIEL-SUBRAYADO-CURSOR-NITIDEZ-1) — nunca la clase de subrayado sobre el h3 mismo', () => {
  const html = renderTarjeta();
  assert.match(html, /<h3 class="text-xl font-playfair text-\[var\(--sf-sobre-banda,var\(--sf-tinta\)\)\]"><span class="[^"]*">Café Nariño 500g<\/span><\/h3>/);
});

test('TarjetaRiel: el nombre lleva `navHoverClase` tal cual se lo pasan — sin `navTratamiento.subrayado` cae a `hover:underline`, byte-idéntico a hoy (sigue el texto línea por línea, nativo, sin truco)', () => {
  const html = renderTarjeta(PRODUCTO_FIXTURE, 'hover:underline');
  assert.match(html, /<span class="hover:underline">Café Nariño 500g<\/span>/);
});

test('TarjetaRiel: con `navTratamiento.subrayado` (CORTE), el nombre lleva la gramática MULTI-LÍNEA — `background-size` sobre un inline con `box-decoration-clone`, MISMOS tokens que StoreNav (220ms, la curva, 1px, currentColor)', () => {
  const claseNav = '[background-image:linear-gradient(currentColor,currentColor)] bg-no-repeat bg-left-bottom bg-size-[0%_1px] box-decoration-clone transition-[background-size] duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-size-[100%_1px] motion-reduce:transition-none';
  const html = renderTarjeta(PRODUCTO_FIXTURE, claseNav);
  // `box-decoration-clone` es LO QUE HACE que el subrayado siga cada línea (§ el docstring de
  // cabecera de GrindChooserRiel.tsx) — sin él, un nombre partido en varias líneas subraya sólo
  // la última, el defecto exacto que este slice cierra.
  assert.match(html, /box-decoration-clone/);
  assert.match(html, /hover:bg-size-\[100%_1px\]/);
  assert.match(html, /duration-\[220ms\]/, 'MISMA duración que StoreNav.tsx — token reusado, no un valor nuevo');
  assert.match(html, /ease-\[cubic-bezier\(0\.22,0\.61,0\.36,1\)\]/, 'MISMA curva que StoreNav.tsx');
  assert.match(html, /motion-reduce:transition-none/, '"aparece sin animar" bajo movimiento reducido');
  assert.doesNotMatch(html, /after:scale-x-100/, 'NUNCA la gramática de bloque de `after:` — es la que no sigue el texto partido');
  assert.doesNotMatch(html, /hover:underline/);
});

test('TarjetaRiel: el ojo y el carrito muestran `cursor-pointer` (§ RIEL-SUBRAYADO-CURSOR-NITIDEZ-1, gate del owner: "El \'ojo\' y el carrito deberían tener \'cursor-pointer\'")', () => {
  const html = renderTarjeta();
  const botonOjo = html.match(/<button[^>]*aria-label="Vista rápida de Café Nariño 500g"[^>]*>/);
  const botonCarrito = html.match(/<button[^>]*aria-label="Agregar Café Nariño 500g al carrito"[^>]*>/);
  assert.ok(botonOjo, 'el botón ojo debe estar presente');
  assert.ok(botonCarrito, 'el botón carrito debe estar presente');
  assert.match(botonOjo![0], /\bcursor-pointer\b/);
  assert.match(botonCarrito![0], /\bcursor-pointer\b/);
});

test('TarjetaRiel: sin foto en absoluto, cae al placeholder de marca — nunca un <img src=""> roto', () => {
  const html = renderTarjeta({ ...PRODUCTO_FIXTURE, imagen: '', imagenes: [] });
  assert.doesNotMatch(html, /src=""/);
});

// ─── ACCIONES-RAPIDAS-CUADRADAS-1 — forma cuadrada + entrada del prototipo ─────────────────────────
// RE-MEDIDO por § SUSCRIPCION-FOTO-LEGIBLE-Y-ACCIONES-REDONDEADAS-1 (2026-10-01): "cuadrado" (0px,
// `sf-pildora` bajo 'recta') resultó DEMASIADO recto — gate del owner: "redondea las esquinas sólo
// un poco". El test deja de afirmar `sf-pildora` y pasa a afirmar `sf-radio-lg` (el rol "chips/
// controles pequeños" de `formas.ts`, 4px en 'recta' desde § RADIO-UN-POCO-MAS-1 — antes 2px — /6px
// en 'minima', sin cambios) — nunca `rounded-full` (el círculo de antes de TODO este eje) ni
// `sf-pildora` (el radio de botón/chrome, el "muy recto" que este slice corrige).

test('TarjetaRiel: el ojo y el carrito llevan esquinas APENAS redondeadas (`sf-radio-lg`), nunca `rounded-full` ni `sf-pildora` — gate del owner: "redondea las esquinas sólo un poco"', () => {
  const html = renderTarjeta();
  const botonOjo = html.match(/<button[^>]*aria-label="Vista rápida de Café Nariño 500g"[^>]*>/);
  const botonCarrito = html.match(/<button[^>]*aria-label="Agregar Café Nariño 500g al carrito"[^>]*>/);
  assert.ok(botonOjo, 'el botón ojo debe estar presente');
  assert.ok(botonCarrito, 'el botón carrito debe estar presente');
  assert.match(botonOjo![0], /\bsf-radio-lg\b/);
  assert.match(botonCarrito![0], /\bsf-radio-lg\b/);
  assert.doesNotMatch(botonOjo![0], /rounded-full/);
  assert.doesNotMatch(botonCarrito![0], /rounded-full/);
  assert.doesNotMatch(botonOjo![0], /\bsf-pildora\b/);
  assert.doesNotMatch(botonCarrito![0], /\bsf-pildora\b/);
});

test('TarjetaRiel: el ojo y el carrito entran deslizando desde la derecha, como `.quick-acts button` del prototipo — reposo opacity-0/translate-x-[14px], hover/foco de TECLADO de la TARJETA (§ VISTA-RAPIDA-CENTRADA-1, group-has-[:focus-visible], no group-focus-within) → opacity-100/translate-x-0, MISMOS tokens 220ms/cubic-bezier(0.22,0.61,0.36,1) que `navHoverClase`/StoreNav', () => {
  const html = renderTarjeta();
  const botonOjo = html.match(/<button[^>]*aria-label="Vista rápida de Café Nariño 500g"[^>]*>/)![0];
  const botonCarrito = html.match(/<button[^>]*aria-label="Agregar Café Nariño 500g al carrito"[^>]*>/)![0];
  for (const boton of [botonOjo, botonCarrito]) {
    assert.match(boton, /\bopacity-0\b/);
    assert.match(boton, /\btranslate-x-\[14px\]/);
    assert.match(boton, /\bgroup-hover:translate-x-0\b/);
    assert.match(boton, /\bgroup-hover:opacity-100\b/);
    assert.match(boton, /\bgroup-has-\[:focus-visible\]:translate-x-0\b/);
    assert.match(boton, /\bgroup-has-\[:focus-visible\]:opacity-100\b/);
    assert.doesNotMatch(boton, /group-focus-within/, 'group-focus-within reacciona al foco programático que deja el modal al cerrar — el defecto que VISTA-RAPIDA-CENTRADA-1 cierra');
    assert.match(boton, /duration-\[220ms\]/);
    assert.match(boton, /ease-\[cubic-bezier\(0\.22,0\.61,0\.36,1\)\]/);
  }
});

test('TarjetaRiel: el CARRITO (2º botón) lleva el retraso escalonado del prototipo (`delay-[60ms]`, `.quick-acts button:nth-child(2)`) — el OJO (1º) no', () => {
  const html = renderTarjeta();
  const botonOjo = html.match(/<button[^>]*aria-label="Vista rápida de Café Nariño 500g"[^>]*>/)![0];
  const botonCarrito = html.match(/<button[^>]*aria-label="Agregar Café Nariño 500g al carrito"[^>]*>/)![0];
  assert.doesNotMatch(botonOjo, /delay-\[60ms\]/);
  assert.match(botonCarrito, /delay-\[60ms\]/);
});

test('TarjetaRiel: el contenedor de acciones rápidas YA NO anima opacidad — cada botón anima la suya (§ ACCIONES-RAPIDAS-CUADRADAS-1)', () => {
  const html = renderTarjeta();
  const m = html.match(/<div class="(pointer-events-none absolute right-3 top-3[^"]*)"/);
  assert.ok(m, 'el contenedor de acciones rápidas debe estar presente');
  assert.doesNotMatch(m![1], /opacity-0/);
  assert.doesNotMatch(m![1], /transition-opacity/);
});
