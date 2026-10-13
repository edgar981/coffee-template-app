import { test } from 'node:test';
import assert from 'node:assert/strict';
// Deep import a un path interno de next: fuera del pipeline de build (sin `next build`/
// `next dev`), `next/image` no recibe `ImageConfigContext` y cae al `imageConfigDefault` de
// fábrica (`qualities: [75]`), así que CUALQUIER `quality` pedido se clampea al más cercano de
// esa lista — medido: `quality={90}` rendía `q=75` en el `srcSet`, sin tocar el prop ni el
// componente. Se iguala ACÁ a lo que `next.config.ts` → `images.qualities` YA declara en
// producción ([75, 85, 90]) — no se INVENTA un valor, se replica el real para que la aserción mida
// lo mismo que vería el navegador.
import { imageConfigDefault } from 'next/dist/shared/lib/image-config';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TiendaEncabezado from '@/components/storefront/tienda/TiendaEncabezado';
import TiendaInterludio from '@/components/storefront/tienda/TiendaInterludio';
import TiendaCierre from '@/components/storefront/tienda/TiendaCierre';
import TiendaTaquilla from '@/components/storefront/tienda/TiendaTaquilla';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { CartProvider } from '@/lib/cartStore';
import { DEFAULTS, type SiteContentData } from '@/lib/config/site-content-defaults';
import type { Product } from '@/types/product';

// § ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1 — las piezas de /tienda de Onix (Apertura, InterludioPlano,
// CierreFraseYBoton) se extrajeron a sus propios archivos, PRESENTACIONALES (props, nunca
// `useSiteContent` adentro), para que /suscripciones y /nosotros las monten con contenido propio
// (§ ONIX-PAGINAS-COMPOSICIONES-CENSO-1, aprobado por el owner el 2026-10-11). Esta prueba afirma
// que estas piezas compartidas rinden igual en /tienda que en las páginas que las reusan — con DOS
// excepciones DECLARADAS: la calidad y el `sizes` de las fotos, el pedido del owner ("The current
// ones don't look in HD quality") que la tanda de la extracción resolvió.
//
// § ONIX-PAGINAS-FIDELIDAD-ASSERTS-1 (cierra `ONIX-PAGINAS-FIDELIDAD-STALE-ASSERTS-1`) — CINCO de
// los seis "ANTES" (`apertura`, `interludioPlano`, `cierreFraseYBotonSinWhatsapp`,
// `cierreFraseYBotonConWhatsapp`, `taquilla`) dejaron de congelar el árbol previo a
// `ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1` y pasaron a congelar el árbol APROBADO por
// `ONIX-PAGINAS-FIDELIDAD-1` (2026-10-12: título quieto sin recorte de acentos, filetes de tinta,
// colores, Taquilla con la presentación elegida en resumen/mensaje). La tabla de abajo, § ANTES,
// documenta cada diferencia contra su punto del asiento de `ONIX-PAGINAS-FIDELIDAD-1`. El SEXTO
// ("interludioRetrato") no cambió — ninguna de las piezas que esa composición monta estuvo en el
// alcance de `ONIX-PAGINAS-FIDELIDAD-1` — y sigue congelando el árbol de la extracción original.
//
// MÉTODO: `renderToStaticMarkup` (sin jsdom, el repo no lo tiene, § CLAUDE.md) sobre las
// composiciones REALES de Onix (apertura + taquilla + créditos + interludio + cierre), contra un
// "ANTES" congelado por render (el procedimiento original vive en `DECISIONS.md`,
// `ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1`; la actualización de los cinco vive en
// `ONIX-PAGINAS-FIDELIDAD-ASSERTS-1`). La comparación STRIPEA `<img .../>` y
// `<link rel="preload" .../>` —ahí vive TODA la diferencia de `quality`/`sizes`— y exige el resto
// BYTE A BYTE idéntico. Las imágenes se verifican aparte, por su contenido (§ abajo).

imageConfigDefault.qualities = [75, 85, 90];

const negocio = 'Café Onix';

// EL CATÁLOGO REAL DE ONIX (§ TIENDA-COMPOSICIONES-CENSO-1), el MISMO fixture de forma que
// `taquilla.test.ts` (2 categorías × 2 pesos, matriz completa) — con `imagen`/`notas` agregados,
// que ese archivo no necesita pero esta prueba sí (ejercita el `<Image>` y el nombre base+notas de
// la columna de compra).
function onixCatalog(): Product[] {
  return [
    { id: 'p-grano-500', nombre: 'Café Onix — En grano 500 g', slug: 'onix-grano-500', categoria: 'Café en Grano', precio: 35000, costo: 0, sku: null, stock: 10, activo: true, peso_gramos: 500, disponible: true, imagen: '/images/onix-grano-500.jpg', notas: ['Chocolate', 'Panela'], moliendasOpciones: [{ metodo: '', nombre: 'Grano entero', disponible: true }], descripcion: '' },
    { id: 'p-molido-500', nombre: 'Café Onix — Molido 500 g', slug: 'onix-molido-500', categoria: 'Café Molido', precio: 35000, costo: 0, sku: null, stock: 10, activo: true, peso_gramos: 500, disponible: true, imagen: '/images/onix-molido-500.jpg', notas: [], moliendasOpciones: [], descripcion: '' },
    { id: 'p-molido-250', nombre: 'Café Onix — Molido 250 g', slug: 'onix-molido-250', categoria: 'Café Molido', precio: 20000, costo: 0, sku: null, stock: 10, activo: true, peso_gramos: 250, disponible: true, imagen: '/images/onix-molido-250.jpg', notas: [], moliendasOpciones: [], descripcion: '' },
    { id: 'p-grano-250', nombre: 'Café Onix — En grano 250 g', slug: 'onix-grano-250', categoria: 'Café en Grano', precio: 20000, costo: 0, sku: null, stock: 10, activo: true, peso_gramos: 250, disponible: true, imagen: '/images/onix-grano-250.jpg', notas: [], moliendasOpciones: [], descripcion: '' },
  ];
}

function contentCon(over: Partial<SiteContentData>): SiteContentData {
  return { ...DEFAULTS, ...over };
}

function render(node: React.ReactNode, content: SiteContentData): string {
  return renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(CartProvider, { children: node }) }),
  );
}

/** Stripea `<img .../>` y `<link rel="preload" .../>` — los DOS únicos lugares donde `quality`/
 *  `sizes` dejan rastro en el HTML (el `<link>` lo emite `priority`, § Apertura). Todo lo demás de
 *  la composición (clases, textos, estructura) debe quedar byte a byte igual tras esto. */
function sinImagenes(html: string): string {
  return html.replace(/<img[^>]*\/>/g, '<img/>').replace(/<link rel="preload"[^>]*\/>/g, '');
}

// EL "ANTES" CONGELADO — capturado con `renderToStaticMarkup` contra el código de ESTE repo
// (las mismas seis composiciones, el mismo fixture de abajo), YA STRIPEADO de `<img>`/
// `<link preload>` (el procedimiento completo, con el script de captura, vive en `DECISIONS.md`).
// Es la referencia contra la que se mide que estas piezas no divergen entre /tienda y las páginas
// que las reusan. CINCO de las seis claves (todas salvo `interludioRetrato`) congelan el árbol
// APROBADO por `ONIX-PAGINAS-FIDELIDAD-1` (2026-10-12), no el que había antes de esa tanda — cada
// una lleva su comentario con el punto del asiento que explica su diferencia contra el árbol viejo
// (§ `ONIX-PAGINAS-FIDELIDAD-ASSERTS-1`).
// LOS CARACTERES NO-ASCII van como `\uXXXX` A PROPÓSITO (generados con un script contra la
// captura — § DECISIONS.md), nunca tipeados a mano: la non-breaking space de `formatCOP`
// (`Intl.NumberFormat('es-CO', …)`, U+00A0 entre "$" y el monto) es INVISIBLE y una edición manual
// la confunde con un espacio normal — exactamente lo que pasó en el primer intento de este archivo
// y lo que esta forma evita de raíz.
const ANTES: Record<string, string> = {
  // ACTUALIZADO por § ONIX-PAGINAS-FIDELIDAD-ASSERTS-1, cerrando `ONIX-PAGINAS-FIDELIDAD-
  // STALE-ASSERTS-1`: tres diferencias, las tres del bullet de `Apertura.tsx` en el asiento de
  // `ONIX-PAGINAS-FIDELIDAD-1` (`DECISIONS.md`, 2026-10-12) — (1) el velo pasó de
  // `tinta/40→transparente→tinta/80` a `rgba(0,0,0,.18)→transparente(30%)→tinta al 35%`
  // (`color-mix`); (2) los rótulos de esquina de `text-[var(--sf-fondo)]/60` a
  // `text-[var(--sf-fondo)]` (100% de opacidad); (3) el `overflow-hidden` del wrapper interno que
  // recortaba la tilde de los acentos («CAFÉ» → «CAFE») se retiró — defecto, no parte de la
  // decisión de movimiento. `/tienda` (vía `TiendaEncabezado`) no pasa `quieto`, así que
  // `Apertura.tsx` sigue envolviendo el `<h1>` en `<Movimiento id="T06">` — que, con `id`
  // presente, monta un `<div>` SIN `className`/`style` (§ `Movimiento.tsx`) — igual que antes.
  apertura: '<section class="relative flex h-[85vh] min-h-[480px] w-full flex-col overflow-hidden bg-[var(--sf-tinta)]"><img/><div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),transparent_30%,color-mix(in_srgb,var(--sf-tinta)_35%,transparent)_100%)]"></div><div class="relative z-10 flex items-start justify-between px-6 pt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-fondo)] sm:px-10"><span>Caf\u00e9 Onix</span><span>Cosecha 2026</span></div><div class="relative z-10 mt-auto pb-6 sm:pb-10"><div><h1 class="sf-movimiento-gigante select-none whitespace-nowrap font-playfair text-[clamp(60px,14vw,220px)] uppercase leading-[0.82] text-[var(--sf-fondo)]">ONIX</h1></div></div></section>',
  interludioRetrato: '<section class="py-16" style="opacity:0;transform:translateY(16px)"><div class="max-w-6xl px-4 sm:px-6 lg:px-8 mx-auto"><div class="mx-auto flex max-w-sm flex-col items-center text-center"><div class="relative w-[70%] overflow-hidden rounded-t-full rounded-b-[20px]" style="aspect-ratio:4 / 5"><img/></div><p class="mt-6 font-playfair text-2xl italic text-[var(--sf-tinta)]">“El café que nos conecta con la tierra.”</p><p class="mt-3 text-sm text-[var(--sf-texto)]">— Familia Onix</p></div></div></section>',
  // ACTUALIZADO por § ONIX-NOSOTROS-ESCENAS-FICHA-1, cerrando `ONIX-PIEZAS-COMPARTIDAS-GOLDEN-
  // INTERLUDIO-1` (abierto por `ONIX-APERTURA-MOVIL-INTERLUDIO-PARALLAX-1`, que le dio a
  // `InterludioPlano` el parallax I03 sin tocar este archivo porque no estaba en su `touches:`):
  // el `<img/>` ya no es hijo DIRECTO de la `<section>` — `Movimiento` (con `id="I03"`) envuelve la
  // capa sobredimensionada que lo contiene (`absolute inset-0` → `absolute inset-x-0 -top-[12%]
  // -bottom-[12%]` → `<img/>`), por contrato: nunca hace pass-through con `id` presente. Es un
  // cambio de FIXTURE (una línea), no una decisión de producto — medido contra el HTML real que
  // `InterludioPlano.tsx` rinde hoy, visto fallar con el string viejo antes de este cambio.
  //
  // ACTUALIZADO de nuevo por § ONIX-PAGINAS-FIDELIDAD-ASSERTS-1, cerrando `ONIX-PAGINAS-FIDELIDAD-
  // STALE-ASSERTS-1`: dos diferencias del bullet de `InterludioPlano.tsx` en el asiento de
  // `ONIX-PAGINAS-FIDELIDAD-1` (`DECISIONS.md`, 2026-10-12) — (1) el alto en móvil pasa de
  // `aspect-[4/5]` (≈488px) a FIJO `h-[400px]` (con `sm:h-auto` para que el escritorio, sin cambio,
  // siga en `sm:aspect-[21/9]`); (2) el pie deja de ser una franja con degradé
  // (`bg-gradient-to-t from-tinta/70`) y pasa a texto crema plena con `text-shadow` posicionado
  // absoluto sobre la imagen — como la maqueta.
  interludioPlano: '<section class="relative h-[400px] w-full overflow-hidden sm:aspect-[21/9] sm:h-auto" style="opacity:0;transform:translateY(16px)"><div class="absolute inset-0"><div class="absolute inset-x-0 -top-[12%] -bottom-[12%]"><img/></div></div><p class="absolute bottom-7 left-6 z-10 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-fondo)] [text-shadow:0_1px_8px_rgba(0,0,0,0.4)] sm:left-10">La finca, al amanecer</p></section>',
  // ACTUALIZADOS (los dos: sin y con WhatsApp) por § ONIX-PAGINAS-FIDELIDAD-ASSERTS-1, cerrando
  // `ONIX-PAGINAS-FIDELIDAD-STALE-ASSERTS-1`: el bullet de `CierreFraseYBoton.tsx` en el asiento de
  // `ONIX-PAGINAS-FIDELIDAD-1` (`DECISIONS.md`, 2026-10-12) — layout CENTRADO (`flex-wrap
  // items-center justify-center gap-6 text-center sm:gap-[144px]`, en vez de `flex-col items-start
  // gap-6 sm:flex-row sm:items-center sm:justify-between`); la frase sube a 44px en escritorio
  // (`text-[28px] sm:text-[44px]`, antes `text-3xl sm:text-4xl` = 30px/36px); el botón deja la
  // píldora (`sf-pildora`, `text-sm font-medium`) por esquina recta uppercase
  // (`rounded-[2px] text-[13px] font-semibold uppercase tracking-[0.06em]`) — el chrome de botón de
  // toda la maqueta, no sólo de esta pieza.
  //
  // ACTUALIZADOS DE NUEVO por § ONIX-CIERRE-Y-CURSOR-1: la banda y las medidas, no el layout de
  // arriba. (1) `py-16` → `py-12 sm:py-16` (clamp(48px,5cqi,64px) de la maqueta, el mismo swap por
  // breakpoint que ya usa la frase — `/tienda` no pasa `bandaPapel`, así que NO lleva
  // `bg-[var(--sf-papel)]`: su propia maqueta, `.scratch/refero-paginas/r2-onix-tienda.md`, pide
  // "banda crema" = el fondo de la página, sin tinte propio). (2) el botón pasa de `px-6 py-3` (24px
  // horizontal correcto; 12px vertical que no garantiza el `min-height:46px` de la maqueta) a
  // `inline-flex min-h-[46px] items-center justify-center px-6` (24px horizontal, 46px de alto
  // centrado por flex — igual que `.btn-borde` de la maqueta).
  cierreFraseYBotonSinWhatsapp: '<section class="py-12 sm:py-16" style="opacity:0;transform:translateY(16px)"><div class="max-w-6xl px-4 sm:px-6 lg:px-8 mx-auto"><div class="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 text-center sm:gap-[144px]"><p class="font-playfair text-[28px] uppercase leading-tight text-[var(--sf-tinta)] sm:text-[44px]">UN CAF\u00c9 PARA CADA MA\u00d1ANA</p><a class="inline-flex min-h-[46px] shrink-0 cursor-pointer items-center justify-center rounded-[2px] px-6 text-[13px] font-semibold uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] border border-[var(--sf-tinta)] text-[var(--sf-tinta)] hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)]" href="/suscripciones">Ver suscripciones</a></div></div></section>',
  cierreFraseYBotonConWhatsapp: '<section class="py-12 sm:py-16" style="opacity:0;transform:translateY(16px)"><div class="max-w-6xl px-4 sm:px-6 lg:px-8 mx-auto"><div class="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 text-center sm:gap-[144px]"><p class="font-playfair text-[28px] uppercase leading-tight text-[var(--sf-tinta)] sm:text-[44px]">UN CAF\u00c9 PARA CADA MA\u00d1ANA</p><a href="https://wa.me/573001234567?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20el%20env%C3%ADo%20mensual." target="_blank" rel="noreferrer" class="inline-flex min-h-[46px] shrink-0 cursor-pointer items-center justify-center rounded-[2px] px-6 text-[13px] font-semibold uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] border border-[var(--sf-tinta)] text-[var(--sf-tinta)] hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)]">Suscr\u00edbete</a></div></div></section>',
  // ACTUALIZADO por § ONIX-PAGINAS-FIDELIDAD-ASSERTS-1, cerrando `ONIX-PAGINAS-FIDELIDAD-
  // STALE-ASSERTS-1`: la ÚNICA zona que cambia es la banda de créditos (Finca/Altitud/Variedad),
  // por el bullet de `TiendaCreditos.tsx` (`CreditosFilas`) en el asiento de
  // `ONIX-PAGINAS-FIDELIDAD-1` (`DECISIONS.md`, 2026-10-12) — filete de `--sf-tinta`/15 (no
  // `--sf-linea`/15, invisible para Onix), ARRIBA de la primera fila Y ABAJO de cada una (N+1
  // bordes: `border-t` en la 1ª + `border-b` en las 3, en vez de `border-t … first:border-t-0` =
  // N−1); dt/dd colapsan al rol único «texto principal en la tinta»
  // (`text-[var(--sf-tinta)]` en las dos columnas, no `--sf-texto-suave` en el rótulo). El resto de
  // la Taquilla (grid de precios, botón «Agregar») no está en el alcance de ese bullet y no cambia.
  taquilla: '<div><div class="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start"><div class="relative mx-auto aspect-square w-full max-w-md overflow-hidden bg-[var(--sf-superficie)]"><img/></div><div><h2 class="font-playfair text-3xl text-[var(--sf-tinta)] sm:text-4xl">Caf\u00e9 Onix</h2><div class="mt-8 grid overflow-hidden border border-[var(--sf-linea)]/20" style="grid-template-columns:minmax(0,1fr) repeat(2, minmax(0,1fr))"><div></div><div class="border-l border-[var(--sf-linea)]/20 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">250 g</div><div class="border-l border-[var(--sf-linea)]/20 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">500 g</div><div class="flex items-center border-t border-[var(--sf-linea)]/20 px-3 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">Caf\u00e9 en Grano</div><button type="button" aria-pressed="true" class="relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center font-playfair text-xl tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sf-acento)] sm:min-h-[72px] sm:text-2xl bg-[var(--sf-tinta)] text-[var(--sf-fondo)]">$\u00a020.000</button><button type="button" aria-pressed="false" class="relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center font-playfair text-xl tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sf-acento)] sm:min-h-[72px] sm:text-2xl text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)]">$\u00a035.000</button><div class="flex items-center border-t border-[var(--sf-linea)]/20 px-3 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">Caf\u00e9 Molido</div><button type="button" aria-pressed="false" class="relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center font-playfair text-xl tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sf-acento)] sm:min-h-[72px] sm:text-2xl text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)]">$\u00a020.000</button><button type="button" aria-pressed="false" class="relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center font-playfair text-xl tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sf-acento)] sm:min-h-[72px] sm:text-2xl text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)]">$\u00a035.000</button></div><div class="mt-6"><button type="button" class="sf-pildora block w-full cursor-pointer bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]">Agregar \u00b7 $\u00a020.000</button></div><div class="mt-8"><div class="flex items-baseline justify-between gap-4 border-b border-[var(--sf-tinta)]/15 py-3.5 border-t border-[var(--sf-tinta)]/15"><span class="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[var(--sf-tinta)]">Finca</span><span class="text-right text-[15px] text-[var(--sf-tinta)]">La Esperanza</span></div><div class="flex items-baseline justify-between gap-4 border-b border-[var(--sf-tinta)]/15 py-3.5 "><span class="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[var(--sf-tinta)]">Altitud</span><span class="text-right text-[15px] text-[var(--sf-tinta)]">1800 msnm</span></div><div class="flex items-baseline justify-between gap-4 border-b border-[var(--sf-tinta)]/15 py-3.5 "><span class="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[var(--sf-tinta)]">Variedad</span><span class="text-right text-[15px] text-[var(--sf-tinta)]">Castillo</span></div></div></div></div></div>',
};

// LOS SEIS RENDERS DE HOY — mismas composiciones, mismo fixture que produjo `ANTES`.
function renders(): Record<string, string> {
  const out: Record<string, string> = {};

  out.apertura = render(
    React.createElement<{ negocio?: string }>(TiendaEncabezado, { negocio }),
    contentCon({
      tiendaEncabezado: {
        ...DEFAULTS.tiendaEncabezado,
        variante: 'apertura',
        titulo: 'ONIX',
        imagen: '/images/onix-apertura.jpg',
        rotuloIzquierda: 'Café Onix',
        rotuloDerecha: 'Cosecha 2026',
      },
    }),
  );

  out.interludioRetrato = render(
    React.createElement(TiendaInterludio),
    contentCon({
      tiendaInterludio: {
        ...DEFAULTS.tiendaInterludio,
        imagen: '/images/onix-retrato.jpg',
        cita: 'El café que nos conecta con la tierra.',
        firma: 'Familia Onix',
      },
    }),
  );

  out.interludioPlano = render(
    React.createElement(TiendaInterludio),
    contentCon({
      tiendaInterludio: {
        ...DEFAULTS.tiendaInterludio,
        variante: 'plano',
        imagen: '/images/onix-plano.jpg',
        pie: 'La finca, al amanecer',
      },
    }),
  );

  out.cierreFraseYBotonSinWhatsapp = render(
    React.createElement<{ whatsapp?: string }>(TiendaCierre, {}),
    contentCon({
      tiendaCierre: {
        ...DEFAULTS.tiendaCierre,
        variante: 'fraseYBoton',
        frase: 'UN CAFÉ PARA CADA MAÑANA',
        boton: 'Suscríbete',
      },
      paginas: { ...DEFAULTS.paginas, suscripciones: { ...DEFAULTS.paginas.suscripciones, visible: true } },
    }),
  );

  out.cierreFraseYBotonConWhatsapp = render(
    React.createElement<{ whatsapp?: string }>(TiendaCierre, { whatsapp: '573001234567' }),
    contentCon({
      tiendaCierre: {
        ...DEFAULTS.tiendaCierre,
        variante: 'fraseYBoton',
        frase: 'UN CAFÉ PARA CADA MAÑANA',
        boton: 'Suscríbete',
      },
    }),
  );

  out.taquilla = render(
    React.createElement(TiendaTaquilla, { catalog: onixCatalog(), whatsapp: '573001234567', barraFijaMovil: true }),
    contentCon({
      tiendaCreditos: {
        visible: true,
        items: [
          { etiqueta: 'Finca', valor: 'La Esperanza' },
          { etiqueta: 'Altitud', valor: '1800 msnm' },
          { etiqueta: 'Variedad', valor: 'Castillo' },
        ],
      },
    }),
  );

  return out;
}

for (const clave of Object.keys(ANTES)) {
  test(`byte-identidad (salvo <img>/<link preload>): "${clave}" — la extracción de piezas no cambió el árbol`, () => {
    const hoy = renders()[clave];
    assert.equal(sinImagenes(hoy), ANTES[clave], `"${clave}" difiere fuera de las imágenes`);
  });
}

// LAS IMÁGENES, APARTE — la ÚNICA diferencia declarada (§ el docstring de cabecera): quality 85 en
// Apertura e Interludio (las dos composiciones), quality 90 + `sizes` real en Taquilla.

test('Apertura: la foto lleva quality=85 (antes, sin `quality` propio → default 75)', () => {
  const html = renders().apertura;
  const img = html.match(/<img[^>]*>/)![0];
  assert.ok(img.includes('q=85'), 'la foto de Apertura debe pedir calidad 85');
  assert.ok(!img.includes('q=75'), 'no debe quedar ningún candidato en calidad 75');
});

test('Interludio «Retrato y cita»: la foto lleva quality=85', () => {
  const html = renders().interludioRetrato;
  const img = html.match(/<img[^>]*>/)![0];
  assert.ok(img.includes('q=85'));
  assert.ok(!img.includes('q=75'));
});

test('Interludio «Plano»: la foto lleva quality=85', () => {
  const html = renders().interludioPlano;
  const img = html.match(/<img[^>]*>/)![0];
  assert.ok(img.includes('q=85'));
  assert.ok(!img.includes('q=75'));
});

test('Taquilla: la foto del producto lleva quality=90 y el `sizes` real del cuadro (máx. 448px, no 100vw/50vw)', () => {
  const html = renders().taquilla;
  const img = html.match(/<img[^>]*>/)![0];
  assert.ok(img.includes('q=90'), 'la foto de Taquilla debe pedir calidad 90');
  assert.ok(!img.includes('q=75'), 'no debe quedar ningún candidato en calidad 75');
  assert.ok(
    img.includes('sizes="(max-width: 768px) calc(100vw - 32px), 448px"'),
    'el `sizes` debe declarar el ancho real del cuadro (448px), no el 50vw de antes',
  );
  assert.ok(!img.includes('(max-width: 768px) 100vw, 50vw'), 'el `sizes` viejo no debe sobrevivir');
});
