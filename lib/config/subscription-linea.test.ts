import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import SubscriptionCTALinea from '@/components/storefront/home/SubscriptionCTALinea';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';

import { DEFAULTS, type SiteContentData } from './site-content-defaults';
import { derivarPaleta } from './palette-derive';

// SUSCRIPCION-FOTO-LEGIBLE-Y-ACCIONES-REDONDEADAS-1 — gate del owner con captura: "Le puse una
// imagen a la sección de Suscripciones y las letras a penas y se notan". `SubscriptionCTALinea.tsx`
// pintaba el eyebrow/título con `var(--sf-sobre-banda,...)`, que SIN imagen cae al literal de
// siempre (tostado/white) pero CON una banda que trae un esquema CLARO asignado (CORTE·crema, § el
// docstring del componente) resuelve al texto OSCURO que ese esquema deriva para la página crema —
// ilegible sobre una foto con velo oscuro. El fix: con `imagenFondo`, el eyebrow y el título van en
// BLANCO PLENO LITERAL, sin pasar por `--sf-sobre-banda` en absoluto.
//
// `renderToStaticMarkup` sobre el árbol REAL, sin jsdom (§ CLAUDE.md, "El glob NO incluye *.test.tsx"),
// mismo patrón que `cta-banner-foto.test.ts` (que ya ejercita esta misma `SubscriptionCTALinea`).

function renderLinea(content: SiteContentData, style?: React.CSSProperties): string {
  const arbol = React.createElement(SiteContentProvider, {
    value: content,
    children: React.createElement<{ style?: React.CSSProperties }>(SubscriptionCTALinea, { style }),
  });
  return renderToStaticMarkup(arbol);
}

// § SUSCRIPCION-TITULO-Y-RECARGA-1: eyebrow y título dejaron de ser nodos planos — son
// `motion.p`/`motion.h2`, así que `renderToStaticMarkup` les hornea un `style` inline (el estado
// `initial="hidden"` de `fadeUp`/`revelaMascaraVertical`, § el docstring de `TextoEnCascada`). Las
// extracciones toleran ese `style` opcional en vez de exigir que `class="..."` sea el último atributo.

function extraerEyebrow(html: string): string {
  // El eyebrow es el único <p> de la franja; su texto es el `subscriptionCTA.eyebrow` del DEFAULTS.
  const m = html.match(/<p class="([^"]*)"(?: style="[^"]*")?>[^<]*<\/p>/);
  assert.ok(m, 'el <p> del eyebrow debe estar presente');
  return m![1];
}

function extraerTitulo(html: string): string {
  const m = html.match(/<h2 class="([^"]*)"(?: style="[^"]*")?>/);
  assert.ok(m, 'el <h2> del título debe estar presente');
  return m![1];
}

const CON_IMAGEN: SiteContentData = {
  ...DEFAULTS,
  subscriptionCTA: { ...DEFAULTS.subscriptionCTA, imagenFondo: '/images/historia-4-v1.jpg' },
} as SiteContentData;

// ─── SIN imagen: nada cambia (byte-idéntico) ───────────────────────────────────────────────────────

test('SIN imagenFondo: el eyebrow sigue cayendo a `var(--sf-sobre-banda,var(--sf-tostado))` — sin tocar', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  const clase = extraerEyebrow(html);
  assert.match(clase, /var\(--sf-sobre-banda,var\(--sf-tostado\)\)/);
  assert.doesNotMatch(clase, /\btext-white\b/);
});

test('SIN imagenFondo: el título sigue cayendo a `var(--sf-sobre-banda,white)` — sin tocar', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  const clase = extraerTitulo(html);
  assert.match(clase, /var\(--sf-sobre-banda,white\)/);
});

// ─── CON imagen: BLANCO PLENO LITERAL, nunca `--sf-sobre-banda` ────────────────────────────────────

test('CON imagenFondo: el eyebrow pasa a `text-white` LITERAL — ya NO depende de `--sf-sobre-banda`', () => {
  const html = renderLinea(CON_IMAGEN);
  const clase = extraerEyebrow(html);
  assert.match(clase, /\btext-white\b/);
  assert.doesNotMatch(clase, /--sf-sobre-banda/, 'el eyebrow con foto no debe referenciar --sf-sobre-banda en absoluto');
  assert.doesNotMatch(clase, /--sf-tostado/, 'el eyebrow con foto no debe caer al tostado — medido bajo AA contra fotos claras (ver más abajo)');
});

test('CON imagenFondo: el título pasa a `text-white` LITERAL — ya NO depende de `--sf-sobre-banda`', () => {
  const html = renderLinea(CON_IMAGEN);
  const clase = extraerTitulo(html);
  assert.match(clase, /\btext-white\b/);
  assert.doesNotMatch(clase, /--sf-sobre-banda/);
});

// ─── EL ALTO/ESCALA DE SECCIÓN (§ SUSCRIPCION-POSTAL-DE-CIERRE-1) — el título sube a `text-4xl`
// fijo, la MISMA escala que `SubscriptionCTABloque.tsx` ya usa para esta sección en los otros cinco
// presets; y gana el MISMO override `escalaDisplay` que featured/brandStory/presentaciones/
// testimonials/origen ya aplican bajo CORTE, que esta variante nunca llamaba. ────────────────────────

function extraerStyleDelTitulo(html: string): string | null {
  const m = html.match(/<h2 class="[^"]*" style="([^"]*)">/);
  return m ? m[1] : null;
}

test('el título usa la escala FIJA de sección (`text-4xl`) — ya no `text-xl sm:text-2xl`', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  const clase = extraerTitulo(html);
  assert.match(clase, /\btext-4xl\b/);
  assert.doesNotMatch(clase, /\btext-xl\b/);
  assert.doesNotMatch(clase, /\btext-2xl\b/);
});

// § SUSCRIPCION-TITULO-Y-RECARGA-1: el `style` del h2 YA NO está vacío sin `escalaDisplay` — el
// `motion.h2` del revelado por máscara siempre hornea `transform:translateY(100%)` en el HTML del
// servidor (el estado "hidden", § el docstring del componente). Lo que sigue siendo cierto es que
// `font-size` está AUSENTE sin `escalaDisplay:'amplia'` — ésa es la parte que `displayL` gobierna.
test('SIN `tema.escalaDisplay` (DEFAULTS, null — el caso de Nayoli y de los otros cinco presets): el título NO lleva `font-size` — sigue su clase Tailwind de hoy, sólo el `transform` de la máscara', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  const estilo = extraerStyleDelTitulo(html);
  assert.ok(estilo, 'el h2 del revelado por máscara siempre lleva style (el transform horneado)');
  assert.doesNotMatch(estilo!, /font-size/);
  assert.match(estilo!, /transform:translateY\(100%\)/);
});

test('CON `tema.escalaDisplay: "amplia"` (el caso de CORTE): el título toma el font-size de display-l — el MISMO override que featured/brandStory/presentaciones/testimonials/origen ya aplican', () => {
  const contenidoAmplio: SiteContentData = {
    ...DEFAULTS,
    tema: { ...DEFAULTS.tema, escalaDisplay: 'amplia' },
  } as SiteContentData;
  const html = renderLinea(contenidoAmplio);
  const estilo = extraerStyleDelTitulo(html);
  assert.ok(estilo, 'el h2 debe llevar un style inline con escalaDisplay:"amplia"');
  assert.match(estilo!, /font-size:clamp\(48px, 5vw, 76px\)/);
});

// ─── § SUSCRIPCION-TITULO-Y-RECARGA-1 — LA TRANSICIÓN: título por máscara, eyebrow/botón por
// desvanecimiento escalonado, DISTINTA de la cascada por palabras ────────────────────────────────

test('el título va dentro de la máscara estática (`overflow-hidden leading-none`), con la clase marcadora `sf-postal-titulo`', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  assert.match(html, /<div class="overflow-hidden leading-none"><h2 class="sf-postal-titulo /);
});

test('el título NO se divide en palabras — el texto completo vive en UN solo nodo, a diferencia de `TextoEnCascada`', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  assert.match(html, />Tu pedido, cada mes</);
  assert.doesNotMatch(html, /sf-cascada-palabra/, 'esta sección no usa la cascada por palabras de Origen');
});

test('el eyebrow y el grupo de botones llevan la clase marcadora `sf-postal-fade` — el desvanecimiento, no la máscara', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  // `class="..."` nada más — el `<noscript>` también menciona el selector `.sf-postal-fade`, pero
  // eso no es una CLASE aplicada a un nodo, así que no cuenta acá.
  const apariciones = html.match(/class="sf-postal-fade/g) ?? [];
  assert.equal(apariciones.length, 2, 'eyebrow + grupo de botones, ninguno más');
});

test('el `<noscript>` neutraliza las DOS clases marcadoras — sin JS, eyebrow/título/botón se ven completos', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  assert.match(
    html,
    /<noscript><style>\.sf-postal-titulo\{transform:none!important\}\.sf-postal-fade\{opacity:1!important;transform:none!important\}<\/style><\/noscript>/,
  );
});

test('el grupo de botones (ex `motion.div` de bloque) sigue envolviendo los DOS enlaces, ahora con `sf-postal-fade`', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  const m = html.match(/<div class="sf-postal-fade flex shrink-0[^"]*" style="[^"]*">(.*?)<\/div><\/div><\/div><\/section>/);
  assert.ok(m, 'el contenedor de botones debe llevar sf-postal-fade');
  assert.match(m![1], /href="\/suscripciones"/);
});

// ─── EL CASO QUE REPRODUCE EL GATE: una banda con esquema CLARO asignado (CORTE·crema) + foto ──────
// `esquemaStyle` inyecta `--sf-sobre-banda` como `style` INLINE en la <section> raíz (§ esquema-
// style.ts); acá se simula pasando el MISMO `style` que `app/(storefront)/page.tsx` compondría para
// esa banda, con un texto OSCURO real (no un placeholder) — el valor que `derivarEsquema('crema')`
// efectivamente produce para la paleta de CORTE.

test('CON imagenFondo Y un `--sf-sobre-banda` OSCURO heredado (el caso real de CORTE·crema): el texto sigue en blanco, NUNCA el oscuro heredado', () => {
  const paletaCorte = derivarPaleta({ fondo: '#fdfbf7', tinta: '#102407', acento: '#a70004' });
  // 'crema' es identidad de `derivarPaleta` (§ palette-derive.ts, derivarEsquema: "if (id === 'crema')
  // return base"): su `--sf-sobre-banda` es `paletaCorte.texto`, el texto OSCURO de lectura sobre la
  // página clara — exactamente el valor que sobrevivía a la foto antes de este fix.
  const styleEsquemaOscuro = { '--sf-sobre-banda': paletaCorte.texto } as React.CSSProperties;
  const html = renderLinea(CON_IMAGEN, styleEsquemaOscuro);
  const eyebrow = extraerEyebrow(html);
  const titulo = extraerTitulo(html);
  assert.match(eyebrow, /\btext-white\b/);
  assert.match(titulo, /\btext-white\b/);
  assert.doesNotMatch(eyebrow, /--sf-sobre-banda/);
  assert.doesNotMatch(titulo, /--sf-sobre-banda/);
  // El `style` SÍ viaja a la <section> (no se descarta) — lo que cambia es que el eyebrow/título ya
  // no lo CONSUMEN cuando hay foto. Sin esta aserción, un refactor que borrara `style={style}` de la
  // <section> pasaría los tests de arriba igual.
  assert.ok(html.includes(`--sf-sobre-banda:${paletaCorte.texto}`), 'el style oscuro debe seguir llegando a la <section> (no se descarta, sólo se deja de consumir)');
});

// ─── EL CONTRASTE MEDIDO — por qué BLANCO y no `--sf-tostado` (mismo método WCAG que lib/animation.
// test.ts: fórmula WCAG sRGB, componiendo el velo tinta-coloreado sobre fotos de referencia) ───────

function srgbToLin(c: number) { const cs = c / 255; return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4); }
function relLum([r, g, b]: number[]) { return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b); }
function contrasteWcag(c1: number[], c2: number[]) {
  const L1 = relLum(c1), L2 = relLum(c2);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

const TINTA_CORTE = [0x10, 0x24, 0x07]; // raices.tinta de CORTE, themes.ts
const BLANCO = [255, 255, 255];
// Las MISMAS tres fotos claras de referencia que HeroMedia.tsx ya calibró (DECISIONS.md) + una
// oscura (coffee-cherry, el caso real del gate). El PISO del degradado (60%, `from-tinta/60`) es el
// peor punto — el propio docstring del componente lo declara "nunca por debajo de eso".
const FOTOS_REFERENCIA: Record<string, number[]> = {
  arena: [232, 222, 200],
  casiBlanco: [245, 245, 240],
  crema: [238, 230, 214],
  oscura: [35, 20, 12],
};
const ALFA_PISO_VELO = 0.6; // `from-[var(--sf-tinta)]/60`, el extremo más tenue del degradado

test('BLANCO PLENO alcanza AA (≥4.5:1) contra el PEOR punto del velo (60%, tinta de CORTE) en las CUATRO fotos de referencia', () => {
  for (const [nombre, foto] of Object.entries(FOTOS_REFERENCIA)) {
    const compuesto = TINTA_CORTE.map((t, i) => ALFA_PISO_VELO * t + (1 - ALFA_PISO_VELO) * foto[i]);
    const c = contrasteWcag(BLANCO, compuesto);
    assert.ok(c >= 4.5, `blanco contra ${nombre} debía superar AA; dio ${c.toFixed(2)}`);
  }
});

test('`--sf-tostado` de CORTE NO alcanza AA contra el PEOR punto del velo en NINGUNA foto clara — por eso el eyebrow NO puede usarlo con foto', () => {
  const paletaCorte = derivarPaleta({ fondo: '#fdfbf7', tinta: '#102407', acento: '#a70004' });
  const tostadoRgb = [
    parseInt(paletaCorte.tostado.slice(1, 3), 16),
    parseInt(paletaCorte.tostado.slice(3, 5), 16),
    parseInt(paletaCorte.tostado.slice(5, 7), 16),
  ];
  for (const nombre of ['arena', 'casiBlanco', 'crema']) {
    const foto = FOTOS_REFERENCIA[nombre];
    const compuesto = TINTA_CORTE.map((t, i) => ALFA_PISO_VELO * t + (1 - ALFA_PISO_VELO) * foto[i]);
    const c = contrasteWcag(tostadoRgb, compuesto);
    assert.ok(c < 4.5, `tostado contra ${nombre} debía quedar BAJO AA (documentando el defecto); dio ${c.toFixed(2)}`);
  }
});
