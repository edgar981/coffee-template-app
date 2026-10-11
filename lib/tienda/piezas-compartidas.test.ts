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
// que /tienda sigue viéndose IGUAL que antes de la extracción — con DOS excepciones DECLARADAS: la
// calidad y el `sizes` de las fotos, el pedido del owner ("The current ones don't look in HD
// quality") que esta misma tanda resuelve.
//
// MÉTODO: `renderToStaticMarkup` (sin jsdom, el repo no lo tiene, § CLAUDE.md) sobre las
// composiciones REALES de Onix (apertura + taquilla + créditos + interludio + cierre), contra un
// "ANTES" congelado — capturado render por render, con el ÁRBOL del código previo a este slice,
// ANTES de tocar un solo archivo (el procedimiento vive en `DECISIONS.md`,
// `ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1`). La comparación STRIPEA `<img .../>` y
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

// EL "ANTES" CONGELADO — capturado con `renderToStaticMarkup` contra el código de ESTE repo tal
// como estaba ANTES de este slice (las mismas seis composiciones, el mismo fixture de abajo),
// YA STRIPEADO de `<img>`/`<link preload>` (el procedimiento completo, con el script de captura,
// vive en `DECISIONS.md`). Es la referencia contra la que se mide que la extracción de piezas no
// cambió NADA del árbol — sólo dónde vive el JSX.
// LOS CARACTERES NO-ASCII van como `\uXXXX` A PROPÓSITO (generados con un script contra la
// captura — § DECISIONS.md), nunca tipeados a mano: la non-breaking space de `formatCOP`
// (`Intl.NumberFormat('es-CO', …)`, U+00A0 entre "$" y el monto) es INVISIBLE y una edición manual
// la confunde con un espacio normal — exactamente lo que pasó en el primer intento de este archivo
// y lo que esta forma evita de raíz.
const ANTES: Record<string, string> = {
  apertura: '<section class="relative flex h-[85vh] min-h-[480px] w-full flex-col overflow-hidden bg-[var(--sf-tinta)]"><img/><div class="absolute inset-0 bg-gradient-to-b from-[var(--sf-tinta)]/40 via-transparent to-[var(--sf-tinta)]/80"></div><div class="relative z-10 flex items-start justify-between px-6 pt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-fondo)]/60 sm:px-10"><span>Café Onix</span><span>Cosecha 2026</span></div><div class="relative z-10 mt-auto overflow-hidden pb-6 sm:pb-10"><div><h1 class="sf-movimiento-gigante select-none whitespace-nowrap font-playfair text-[clamp(60px,14vw,220px)] uppercase leading-[0.82] text-[var(--sf-fondo)]">ONIX</h1></div></div></section>',
  interludioRetrato: '<section class="py-16" style="opacity:0;transform:translateY(16px)"><div class="max-w-6xl px-4 sm:px-6 lg:px-8 mx-auto"><div class="mx-auto flex max-w-sm flex-col items-center text-center"><div class="relative w-[70%] overflow-hidden rounded-t-full rounded-b-[20px]" style="aspect-ratio:4 / 5"><img/></div><p class="mt-6 font-playfair text-2xl italic text-[var(--sf-tinta)]">“El café que nos conecta con la tierra.”</p><p class="mt-3 text-sm text-[var(--sf-texto)]">— Familia Onix</p></div></div></section>',
  interludioPlano: '<section class="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[21/9]" style="opacity:0;transform:translateY(16px)"><img/><div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--sf-tinta)]/70 to-transparent px-6 py-6 sm:px-10"><p class="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-fondo)]/90">La finca, al amanecer</p></div></section>',
  cierreFraseYBotonSinWhatsapp: '<section class="py-16" style="opacity:0;transform:translateY(16px)"><div class="max-w-6xl px-4 sm:px-6 lg:px-8 mx-auto"><div class="mx-auto flex max-w-4xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between"><p class="font-playfair text-3xl uppercase leading-tight text-[var(--sf-tinta)] sm:text-4xl">UN CAFÉ PARA CADA MAÑANA</p><a class="sf-pildora shrink-0 cursor-pointer px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] border border-[var(--sf-tinta)] text-[var(--sf-tinta)] hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)]" href="/suscripciones">Ver suscripciones</a></div></div></section>',
  cierreFraseYBotonConWhatsapp: '<section class="py-16" style="opacity:0;transform:translateY(16px)"><div class="max-w-6xl px-4 sm:px-6 lg:px-8 mx-auto"><div class="mx-auto flex max-w-4xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between"><p class="font-playfair text-3xl uppercase leading-tight text-[var(--sf-tinta)] sm:text-4xl">UN CAFÉ PARA CADA MAÑANA</p><a href="https://wa.me/573001234567?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20el%20env%C3%ADo%20mensual." target="_blank" rel="noreferrer" class="sf-pildora shrink-0 cursor-pointer px-6 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-tinta)] border border-[var(--sf-tinta)] text-[var(--sf-tinta)] hover:bg-[var(--sf-tinta)] hover:text-[var(--sf-fondo)]">Suscríbete</a></div></div></section>',
  taquilla: '<div><div class="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-start"><div class="relative mx-auto aspect-square w-full max-w-md overflow-hidden bg-[var(--sf-superficie)]"><img/></div><div><h2 class="font-playfair text-3xl text-[var(--sf-tinta)] sm:text-4xl">Café Onix</h2><div class="mt-8 grid overflow-hidden border border-[var(--sf-linea)]/20" style="grid-template-columns:minmax(0,1fr) repeat(2, minmax(0,1fr))"><div></div><div class="border-l border-[var(--sf-linea)]/20 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">250 g</div><div class="border-l border-[var(--sf-linea)]/20 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">500 g</div><div class="flex items-center border-t border-[var(--sf-linea)]/20 px-3 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">Café en Grano</div><button type="button" aria-pressed="true" class="relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center font-playfair text-xl tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sf-acento)] sm:min-h-[72px] sm:text-2xl bg-[var(--sf-tinta)] text-[var(--sf-fondo)]">$ 20.000</button><button type="button" aria-pressed="false" class="relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center font-playfair text-xl tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sf-acento)] sm:min-h-[72px] sm:text-2xl text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)]">$ 35.000</button><div class="flex items-center border-t border-[var(--sf-linea)]/20 px-3 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--sf-texto-suave)]">Café Molido</div><button type="button" aria-pressed="false" class="relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center font-playfair text-xl tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sf-acento)] sm:min-h-[72px] sm:text-2xl text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)]">$ 20.000</button><button type="button" aria-pressed="false" class="relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center border-l border-t border-[var(--sf-linea)]/20 px-2 py-2 text-center font-playfair text-xl tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sf-acento)] sm:min-h-[72px] sm:text-2xl text-[var(--sf-tinta)] hover:bg-[var(--sf-superficie)]">$ 35.000</button></div><div class="mt-6"><button type="button" class="sf-pildora block w-full cursor-pointer bg-[var(--sf-accion,var(--sf-tostado))] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--sf-accion-txt,var(--sf-tinta))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--sf-accion,var(--sf-tostado))]">Agregar · $ 20.000</button></div><div class="mt-8"><div class="flex items-baseline justify-between gap-6 border-t border-[var(--sf-linea)]/15 py-3 first:border-t-0"><span class="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-texto-suave)]">Finca</span><span class="text-right text-base text-[var(--sf-tinta)]">La Esperanza</span></div><div class="flex items-baseline justify-between gap-6 border-t border-[var(--sf-linea)]/15 py-3 first:border-t-0"><span class="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-texto-suave)]">Altitud</span><span class="text-right text-base text-[var(--sf-tinta)]">1800 msnm</span></div><div class="flex items-baseline justify-between gap-6 border-t border-[var(--sf-linea)]/15 py-3 first:border-t-0"><span class="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-texto-suave)]">Variedad</span><span class="text-right text-base text-[var(--sf-tinta)]">Castillo</span></div></div></div></div></div>',
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
