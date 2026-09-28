import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import HeroSection from '@/components/storefront/home/HeroSection';
import HeroMediaMarquesina from '@/components/storefront/home/HeroMediaMarquesina';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';

import {
  DEFAULTS,
  REGISTRY,
  bandaOscuraCanonica,
  bandaUniforme,
  resolverSiteContent,
  resolverVariante,
  type SiteContentData,
} from './site-content-defaults';
import {
  VELO_OPACIDAD_PISO, UMBRAL_REVELADO_TEXTO, claseAlturaAncestroMarquesina,
  OPACIDAD_REVELADO_TECHO, MARQUEE_TITULO_FONT_SIZE, MARQUEE_TITULO_LINE_HEIGHT,
  MARQUEE_TITULO_LETTER_SPACING, MARQUEE_MASCARA_RELLENO_EM,
} from '@/lib/animation';

// MUESTRARIO-HERO-MARQUESINA-STICKY-1 — la CUARTA variante del hero (tras curtina/ficha/media,
// § HeroSection.tsx): el hero y la marquesina dejan de ser DOS bandas apiladas y pasan a ser UNA
// composición, con el hero pineado (`position:sticky`) mientras el texto del marquee y la tarjeta
// del producto pasan POR ENCIMA de su media — MEDIDO contra el tema real
// (`https://x-cafeone.myshopify.com/`, sección `hero_banner_marquee`), NO contra
// `docs/prototipos/cafeone/` (que DERIVA de ese tema: su `.marquee` es una banda APARTE, la forma
// de dos bandas apiladas que el owner reportó como mala). Ver el docstring de cabecera de
// `HeroMediaMarquesina.tsx` para la mecánica completa (el ancestro no-pineado que da el presupuesto
// de scroll, por qué el progreso se mide contra él y no contra la `<section>` pineada, etc.).
//
// LA CLAVE DE LA VARIANTE ES `'sticky'`, NO `'marquesina'` — DESVÍO MEDIDO (§ el docstring de
// `HeroSection.tsx`/`site-content-defaults.ts`): `'marquesina'` ya está reservado en
// `PLIEGO.variantes.hero` (themes.ts) como placeholder de una composición AJENA (el diseño
// "Pliego"), y `themes.test.ts` (fuera de `touches:` de este slice) afirma que ese pedido de PLIEGO
// debe seguir fallando la validación por nombre. Usar 'marquesina' acá lo habría vuelto válido por
// accidente. La SECCIÓN de contenido que este componente lee SÍ sigue llamándose `marquesina`
// (`texto`/`productoSlug`, sin cambios) — es sólo la CLAVE DE VARIANTE la que es 'sticky'.
//
// ESTE ARCHIVO AFIRMA: (1) el modelo — la nueva clave entra al set cerrado de `hero.variantes` sin
// tocar la canónica; (2) el render — la variante lee `marquesina.texto`/`.productoSlug` (NUNCA un
// campo propio del hero — el spec pidió reusar el dato existente, no duplicarlo), el velo sale del
// token `--sf-velo` (nunca un rgba horneado), y el pin es hide-on-empty de UN elemento, como en
// `Marquesina.tsx`; (3) el DISPATCHER (`HeroSection.tsx`) enruta `variante:'sticky'` a este
// componente y deja intactas curtina/ficha/media; (4) movimiento reducido: el texto queda quieto,
// como en `Marquesina.tsx` (mismo gate, mismas funciones puras de `lib/animation.ts`, sin una sola
// línea de motor nueva); (5) Nayoli (sin fila, sin preset) sigue en la canónica 'curtina' — byte-
// idéntica, cero bytes nuevos.

function renderHeroSection(content: SiteContentData, opts: { preview?: boolean } = {}): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(HeroSection) });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

function renderHeroMediaMarquesina(content: SiteContentData, opts: { preview?: boolean } = {}): string {
  const arbol = React.createElement(SiteContentProvider, {
    value: content,
    children: React.createElement(HeroMediaMarquesina),
  });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

// ─── EL MODELO — la clave nueva entra al set cerrado; la canónica NO cambia ───────────────────────

test('REGISTRY.hero.variantes.claves incluye "sticky", CUARTA del set; la canónica sigue siendo "curtina"', () => {
  assert.deepEqual(
    REGISTRY.hero.variantes,
    { claves: ['curtina', 'ficha', 'media', 'sticky'], canonica: 'curtina', noUniformes: ['ficha'] },
  );
});

test('resolverVariante: "sticky" se respeta; basura/ausente sigue cayendo en "curtina"', () => {
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, 'sticky'), 'sticky');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, undefined), 'curtina');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, 'no-existe'), 'curtina');
});

test('DEFAULTS.hero.variante sigue siendo "curtina" — esta variante no la toca (Nayoli byte-idéntica)', () => {
  assert.equal(DEFAULTS.hero.variante, 'curtina');
});

test('hero: una `variante` guardada "sticky" se respeta a través de resolverSiteContent', () => {
  const r = resolverSiteContent({ hero: { variante: 'sticky' } });
  assert.equal(r.hero.variante, 'sticky');
});

// 'sticky' es un solo plano de media (como 'media'): oscura por canónica, uniforme (nav
// transparente-flotante), NUNCA en `noUniformes` — sólo 'ficha' (bi-tonal) está ahí.
test('hero·sticky es OSCURA por canónica y UNIFORME — mismo trato que hero·media', () => {
  assert.equal(bandaOscuraCanonica('hero', 'sticky'), true);
  assert.equal(bandaUniforme('hero', 'sticky'), true);
});

// ─── EL RENDER — lee marquesina.texto/.productoSlug, NUNCA un campo propio del hero ──────────────

test('el texto del loop viene de `marquesina.texto`, NO de ningún campo del hero (eyebrow/titulo no rinden)', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, variante: 'sticky' as const, eyebrow: 'ESTO NO DEBE VERSE', titulo: 'NI ESTO' },
    marquesina: { ...DEFAULTS.marquesina, texto: 'Café fresco todos los días' },
  } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(html.includes('Café fresco todos los días'), 'debe rendir el texto de `marquesina.texto`');
  assert.ok(!html.includes('ESTO NO DEBE VERSE'), 'no debe rendir el eyebrow del hero');
  assert.ok(!html.includes('NI ESTO'), 'no debe rendir el titulo del hero');
});

test('el texto del loop rinde DOS VECES dentro del track (cinta continua), más la 3ª aparición del `aria-label` de la sección', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, texto: 'Calidad que se nota' } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  const apariciones = html.split('Calidad que se nota').length - 1;
  assert.equal(apariciones, 3);
  const enSpans = (html.match(/<span class="pr-8">/g) || []).length;
  assert.equal(enSpans, 2);
});

// ─── EL TAMAÑO Y LA MÁSCARA — § CORTE-HERO-MARQUEE-RONDA-5-1 ──────────────────────────────────────

test('la máscara (el `<div>` de afuera) lleva el font-size/line-height/letter-spacing MEDIDOS, y ya no la className horneada vieja', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.ok(
    html.includes(`font-size:${MARQUEE_TITULO_FONT_SIZE};line-height:${MARQUEE_TITULO_LINE_HEIGHT}`),
    'el style inline debe traer el clamp medido y el interlineado, en ese orden',
  );
  assert.ok(html.includes(`letter-spacing:${MARQUEE_TITULO_LETTER_SPACING}`));
  assert.doesNotMatch(html, /text-\[clamp\(3rem,10vw,10rem\)\]/, 'la className horneada vieja no debe sobrevivir — el tamaño ahora es SIEMPRE el medido');
  assert.doesNotMatch(html, /leading-none/, 'el line-height ahora viaja por style, no por la clase Tailwind');
});

test('la máscara lleva el relleno inferior MEDIDO + el margen negativo que lo compensa (la receta de la pieza de marca, sin el layout corrido)', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.ok(html.includes(`padding-bottom:${MARQUEE_MASCARA_RELLENO_EM}em`));
  assert.ok(html.includes(`margin-bottom:-${MARQUEE_MASCARA_RELLENO_EM}em`));
});

// ─── EL TICKER — § CORTE-HERO-VELO-OFF-Y-TICKER-1: por TIEMPO, nunca "a medio ciclo" al cargar ────
// LÍMITE: `renderToStaticMarkup` no evalúa `animate` (framer-motion sólo lo anima en el cliente, tras
// hidratar) — sólo `initial`/`style` llegan al HTML. Lo que SÍ se puede afirmar acá es que el track
// arranca SIEMPRE en `x:0%` (`transform:none`, § el probe de framer-motion citado en el asiento de
// este slice): si `initial` faltara, el nodo no tendría NINGÚN `style` en absoluto. La curva real
// (duración/keyframes/`repeat:Infinity`) vive en `duracionTickerS`/`VELOCIDAD_TICKER_PX_S`
// (`lib/animation.test.ts`, testeables sin React) y en el gate visual del owner (capa 3).

test('el ticker arranca SIEMPRE en su posición inicial (x:0%, transform:none) — nunca "a medio ciclo" al cargar', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.match(html, /transform:none/, '`initial={{x:"0%"}}` debe rendir style="transform:none" en el track');
});

test('EN PREVIEW: el ticker también arranca en x:0% — detenido, no a medio camino', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData, { preview: true });
  assert.match(html, /transform:none/);
});

test('sin pin (`marquesina.productoSlug` vacío, el default): la tarjeta flotante NO rinde — hide-on-empty de UN elemento', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.ok(!/aspect-\[3\/4\]/.test(html), 'sin pin, no debe rendir el marcado de la tarjeta');
});

test('con `productoSlug` pero SIN catálogo real (SSR, mismo límite que `marquesina-banda.test.ts`/`spotlight-cableado.test.ts`): la tarjeta tampoco rinde', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, productoSlug: 'un-producto-cualquiera' } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(!/aspect-\[3\/4\]/.test(html), 'sin catálogo cargado, la tarjeta flotante no puede resolver el pin');
});

// ─── EL VELO — token `--sf-velo`, overlay PLANO (NO el gradiente de dos paradas de HeroMedia) ────

test('el velo lee `var(--sf-velo)`, NUNCA un rgba/opacidad horneada sobre `--sf-tinta`', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.match(html, /bg-\[var\(--sf-velo\)\]/);
  assert.doesNotMatch(html, /--sf-tinta\)\]\/\d/, 'no debe hornear un modificador de opacidad sobre --sf-tinta');
});

test('el velo es PLANO — una sola referencia a `--sf-velo`, no el `from/via/to` de HeroMedia.tsx', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  const apariciones = (html.match(/var\(--sf-velo\)/g) ?? []).length;
  assert.equal(apariciones, 1, 'un solo overlay plano, no un degradado de dos paradas');
  assert.doesNotMatch(html, /bg-linear-to-b/, 'HeroMediaMarquesina no usa el gradiente de HeroMedia');
});

// § CORTE-HERO-STICKY-RONDA-2-1: el velo YA NO es una opacidad fija — su `style.opacity` sigue el
// progreso de scroll (SSR arranca en progreso=0, mismo límite que el resto de esta sección).
test('SIN el gate estático (SSR, progreso arranca en 0): la opacidad del velo arranca en el PISO, no en 1', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.match(html, new RegExp(`opacity:${VELO_OPACIDAD_PISO}"`), 'debe arrancar en el piso, casi transparente');
});

test('EN PREVIEW (proxy de movimiento reducido): la opacidad del velo es 1 — la densidad de HOY, nunca el piso semitransparente', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData, { preview: true });
  assert.match(html, /opacity:1"/);
  assert.doesNotMatch(html, new RegExp(`opacity:${VELO_OPACIDAD_PISO}"`));
});

// § CORTE-HERO-VELO-OFF-Y-TICKER-1: el velo pasa a ser OPT-IN (`hero.veloVisible`).

test('DEFAULTS.hero.veloVisible es true — el velo de HOY sigue montado por default (byte-idéntico)', () => {
  assert.equal(DEFAULTS.hero.veloVisible, true);
});

test('veloVisible:false — el velo NO se monta en absoluto (ni el nodo, ni --sf-velo en el HTML)', () => {
  const html = renderHeroMediaMarquesina({ ...DEFAULTS, hero: { ...DEFAULTS.hero, veloVisible: false } } as SiteContentData);
  assert.doesNotMatch(html, /--sf-velo/, 'sin veloVisible, ningún rastro del token del velo');
});

// ─── LA MECÁNICA STICKY — el ancestro da el presupuesto de scroll; el panel visible es el pineado ─

test('el panel visible es `sticky top-0`, a `h-[100svh]` SIEMPRE (no lee `alturaLlena`)', () => {
  const conAlturaLlenaFalse = renderHeroMediaMarquesina({ ...DEFAULTS, hero: { ...DEFAULTS.hero, alturaLlena: false } } as SiteContentData);
  const conAlturaLlenaTrue = renderHeroMediaMarquesina({ ...DEFAULTS, hero: { ...DEFAULTS.hero, alturaLlena: true } } as SiteContentData);
  for (const html of [conAlturaLlenaFalse, conAlturaLlenaTrue]) {
    assert.match(html, /sticky top-0/);
    assert.match(html, /h-\[100svh\]/);
  }
  // alturaLlena no cambia NADA del render de esta variante — mismo HTML con true o false.
  assert.equal(conAlturaLlenaFalse, conAlturaLlenaTrue);
});

// § CORTE-HERO-MARQUEE-REVELA-1: `DEFAULTS.marquesina.productoSlug` es `''` (§ site-content-
// defaults.ts), así que `productoSpotlight` SIEMPRE devuelve `null` acá — sin producto que pinear,
// el ancestro usa el presupuesto CORTO (`claseAlturaAncestroMarquesina(false)`), no el de siempre.
// El caso CON tarjeta (200vh) queda sin cambios y afirmado directo sobre la función pura, abajo — el
// mismo límite SSR de `getCatalog()`/`useEffect` que ya documentan los otros tests de esta sección
// (líneas 122-126) impide resolver un `producto` real a través de este harness de render.
test('SIN producto (DEFAULTS, hide-on-empty): el ancestro usa el presupuesto CORTO — no arrastra 200vh cuando no hay tarjeta que mostrar', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.match(html, /min-h-\[calc\(100svh\+65vh\)\]/);
  assert.doesNotMatch(html, /min-h-\[calc\(100svh\+200vh\)\]/);
});

test('claseAlturaAncestroMarquesina: CON tarjeta sigue siendo el presupuesto de SIEMPRE (100svh+200vh, MEDIDO contra `<xo-parallax class="h:300vh">`); SIN tarjeta, 100svh+65vh (200vh menos la ventana [0.12,0.57] de la tarjeta: 0.45×300vh=135vh)', () => {
  assert.equal(claseAlturaAncestroMarquesina(true), 'min-h-[calc(100svh+200vh)]');
  assert.equal(claseAlturaAncestroMarquesina(false), 'min-h-[calc(100svh+65vh)]');
});

// § CORTE-HERO-STICKY-RONDA-2-1 INVIERTE este caso: el owner pidió el cue VISIBLE bajo sticky, así
// que la variante pasó a LEER `hero.cueDesliza` (el mismo campo que `HeroMedia.tsx` ya declara),
// verbatim el mismo marcado (`data-hero-cue="desliza"` + la etiqueta "Desliza").
test('cueDesliza:true — la variante RINDE el cue, mismo marcado que HeroMedia (data-hero-cue + "Desliza")', () => {
  const html = renderHeroMediaMarquesina({ ...DEFAULTS, hero: { ...DEFAULTS.hero, cueDesliza: true } } as SiteContentData);
  assert.match(html, /data-hero-cue="desliza"/);
  assert.match(html, /<span[^>]*>Desliza<\/span>/);
});

test('cueDesliza:false (default) — sin cue, byte-idéntico a la versión previa a esta ronda', () => {
  assert.equal(DEFAULTS.hero.cueDesliza, false);
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, /data-hero-cue/);
});

test('cueDesliza:true, EN PREVIEW — el cue se OMITE (scrollear no significa nada en un marco de vista previa)', () => {
  const html = renderHeroMediaMarquesina(
    { ...DEFAULTS, hero: { ...DEFAULTS.hero, cueDesliza: true } } as SiteContentData,
    { preview: true },
  );
  assert.doesNotMatch(html, /data-hero-cue/);
});

// ─── MOVIMIENTO REDUCIDO (proxy: PreviewProvider, MISMO límite que `marquesina-banda.test.ts`) ───
//
// § CORTE-HERO-REVELADO-MASCARA-1 (RONDA 4) REESCRIBE los dos casos de abajo: el centrado
// (`top-1/2 -translate-y-1/2`) dejó de ser un `style.transform` animado — es una clase ESTÁTICA de
// Tailwind, en el `<div>` de AFUERA (la máscara, `overflow-hidden`). Lo que SÍ sigue siendo
// `style.transform` (vía `useTransform`) es el revelado en sí, en el `<motion.div>` del MEDIO —
// `transformRevelaTextoDisplay`, un PORCENTAJE. § CORTE-MARQUEE-REVELADO-CON-FADE-1 (2026-09-27)
// AMPLÍA los mismos dos casos: ESE `<motion.div>` ahora lleva TAMBIÉN `style.opacity`
// (`opacidadRevelaTextoDisplay`), en el MISMO `style` que el transform — se afirma junto, no aparte,
// porque el punto del slice es que las dos rampas viajan sobre el mismo nodo y terminan juntas.

test('EN PREVIEW (proxy de movimiento reducido): el texto queda CENTRADO (clase estática), el motor de revelado en "translateY(0%)" y al TECHO de peso (§ CORTE-HERO-MARQUEE-RONDA-5-1, ya no 1 pleno) — EN SU LUGAR, sin desplazamiento horizontal ni revelado ni peso a medias', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData, { preview: true });
  assert.match(html, /-translate-y-1\/2/, 'el centrado es una clase Tailwind estática, no un style animado');
  assert.match(html, new RegExp(`transform:translateY\\(0%\\);opacity:${OPACIDAD_REVELADO_TECHO}"`), 'el motor de revelado y la rampa de opacidad deben rendir juntos, "en su lugar" y al TECHO de peso, bajo el gate estático');
  assert.ok(!/translate\(-?\d/.test(html), 'ningún transform de desplazamiento horizontal debe sobrevivir bajo el gate estático');
});

// § CORTE-HERO-VELO-OFF-Y-TICKER-1 (RONDA 3): el eje HORIZONTAL dejó de ser scroll-driven (ya no hay
// `translate(Npx, -50%)` combinado) — es un TICKER por TIEMPO, en un elemento APARTE. Este test
// afirma el eje VERTICAL — hoy el `transform`+`opacity` del `<motion.div>` del MEDIO (el motor de
// revelado y su rampa de peso, § CORTE-MARQUEE-REVELADO-CON-FADE-1).
test('SIN el gate estático (SSR, progreso arranca en 0): el texto arranca FUERA de la máscara (translateY(100%)) y SIN PESO (opacity:0) — el revelado todavía no empezó', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.match(html, /transform:translateY\(100\.0%\);opacity:0"/, 'en reposo, 100% de su propia caja Y sin peso — completamente oculto bajo el borde de la máscara, sin adelantar aclarándose');
  assert.ok(!html.includes('transform:translateY(0.0%)'), 'sin el gate estático no debe rendir la forma "ya revelada" en progreso=0');
  assert.match(html, /overflow-hidden/, 'la máscara (overflow-hidden) debe estar en el marcado — es lo que hace que el 100% oculte de verdad');
});

// ─── EL REVELADO DEL TEXTO — CORTE-HERO-MARQUEE-REVELA-1 (§ el docstring de cabecera de `lib/animation.ts`) ───
// Afirma, contra el RENDER (no sólo las funciones puras de `lib/animation.test.ts`), que el revelado
// se compone con el desplazamiento/velo de siempre sin reemplazarlos, y que se completa DENTRO de la
// ventana temprana declarada (`UMBRAL_REVELADO_TEXTO.hasta`), nunca a lo largo de todo el recorrido.

// El SSR de este componente NO acepta un progreso inyectado (`useProgresoScrollDesdeTope` mide el
// DOM real vía `useScroll`, que no existe bajo `renderToStaticMarkup`) — así que un progreso
// INTERMEDIO real (ni 0 ni el estado final) sólo se puede afirmar sobre las funciones puras, ya
// cubierto en `lib/animation.test.ts` (`transformRevelaTextoDisplay` a progreso=0.1, la mitad de esta
// ventana). Lo que este archivo SÍ puede afirmar por render son los DOS extremos — progreso=0
// (arriba) y el estado final que `estatico` fuerza (abajo)— y que la ventana declarada
// (`UMBRAL_REVELADO_TEXTO.hasta`) es la parte TEMPRANA del progreso, no el recorrido completo.
test('UMBRAL_REVELADO_TEXTO consume la parte TEMPRANA del progreso — no las tres pantallas completas', () => {
  assert.equal(UMBRAL_REVELADO_TEXTO.desde, 0);
  assert.ok(UMBRAL_REVELADO_TEXTO.hasta > 0 && UMBRAL_REVELADO_TEXTO.hasta < 0.5, 'la ventana termina bien antes de la mitad del recorrido');
});

test('al COMPLETAR la ventana de revelado (progreso=0.2, vía el proxy estático que rinde el estado FINAL): translateY(0%) Y opacity:TECHO — ni la posición ni el peso se pasan de su final', () => {
  // `estatico=true` (preview) rinde exactamente el estado que `transformRevelaTextoDisplay`/
  // `opacidadRevelaTextoDisplay` alcanzan al final de la ventana (`translateY(0%)`,
  // `OPACIDAD_REVELADO_TECHO` — § CORTE-HERO-MARQUEE-RONDA-5-1, ya no el pleno 1) — el mismo valor,
  // por diseño (§ sus docstrings: "estatico gana con el estado FINAL"). Lo que NO se puede afirmar
  // por render es el punto EXACTO 0.2 con scroll real; eso vive en `lib/animation.test.ts` (afirmado
  // ahí, además, que las dos rampas llegan JUNTAS a ese punto).
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData, { preview: true });
  assert.match(html, new RegExp(`transform:translateY\\(0%\\);opacity:${OPACIDAD_REVELADO_TECHO}"`));
  assert.doesNotMatch(html, /translateY\(\d+\.\d/, 'ningún translateY con porcentaje NUMÉRICO (100.0%, 50.0%…) debe sobrevivir una vez completo — sólo translateY(0%)');
});

// ─── EL DISPATCHER — HeroSection enruta "sticky"; curtina/ficha/media quedan INTACTAS ────────────

test('HeroSection con `variante:"sticky"` enruta a HeroMediaMarquesina (rinde el panel sticky)', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, variante: 'sticky' as const } } as SiteContentData;
  const html = renderHeroSection(content);
  assert.match(html, /sticky top-0/);
  assert.match(html, /h-\[100svh\]/);
});

test('LA INVARIANTE — Nayoli (sin fila, canónica "curtina"): HeroSection NO rinde nada de la variante nueva', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.hero.variante, 'curtina');
  const html = renderHeroSection(nayoli);
  assert.doesNotMatch(html, /sticky top-0/);
  assert.doesNotMatch(html, /min-h-\[calc\(100svh\+200vh\)\]/);
});

test('HeroSection con `variante:"media"` sigue enrutando a HeroMedia — sin cambios por esta variante nueva', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, variante: 'media' as const } } as SiteContentData;
  const html = renderHeroSection(content);
  // HeroMedia usa min-h-[92vh]/[100svh], nunca el ancestro de presupuesto de scroll de la nueva variante.
  assert.doesNotMatch(html, /min-h-\[calc\(100svh\+200vh\)\]/);
  assert.doesNotMatch(html, /sticky top-0/);
});
