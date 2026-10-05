import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import HeroSection from '@/components/storefront/home/HeroSection';
import HeroMediaMarquesina from '@/components/storefront/home/HeroMediaMarquesina';
import Marquesina from '@/components/storefront/home/Marquesina';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';
import { ModoEditorProvider } from '@/components/storefront/ModoEditor';
import { ATRIBUTO_EDITOR_CAMPO, ATRIBUTO_EDITOR_LINEA } from '@/lib/admin/editor-iframe';

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
  UMBRAL_ENTRADA_TARJETA_MARQUESINA,
} from '@/lib/animation';
import { CORTE, PRESETS } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

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

function renderHeroMediaMarquesina(content: SiteContentData, opts: { preview?: boolean; activo?: boolean } = {}): string {
  let arbol: React.ReactElement = React.createElement(SiteContentProvider, {
    value: content,
    children: React.createElement(HeroMediaMarquesina),
  });
  if (opts.activo) arbol = React.createElement(ModoEditorProvider, { activo: true, children: arbol });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

// § EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1 — `activo` encadena `ModoEditorProvider` (el contexto que
// `CampoEditable` lee, § ModoEditor.tsx) ALREDEDOR de `SiteContentProvider`; sin `activo` (el caso
// por defecto en el resto de este archivo, arriba) no hay provider y `useModoEditorActivo()` cae al
// `false` de `createContext` — el mismo camino que ya ejercitan las decenas de tests existentes de
// este archivo, que por eso NO necesitan tocarse para seguir siendo la prueba del byte-idéntico.
function renderMarquesina(content: SiteContentData, opts: { activo?: boolean } = {}): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(Marquesina) });
  return renderToStaticMarkup(opts.activo ? React.createElement(ModoEditorProvider, { activo: true, children: arbol }) : arbol);
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

// `titularVisible: false` — EXPLÍCITO desde § EDITOR-TIENDA-ZONAS-STICKY-TITULAR-1: `hero.titulo`
// SÍ rinde en esta composición cuando la zona está encendida (default `true`, § el docstring de
// `HeroContent.titularVisible`), así que afirmar "titulo no rinde" exige apagar la zona primero —
// lo que este test afirma de verdad es que `eyebrow` NUNCA rinde (no tiene zona en 'sticky') y que
// el LOOP lee `marquesina.texto`, no `hero.titulo`, sea cual sea el estado de la zona.
test('el texto del loop viene de `marquesina.texto`, NO de ningún campo del hero (eyebrow nunca rinde; titulo no rinde con la zona apagada)', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, variante: 'sticky' as const, eyebrow: 'ESTO NO DEBE VERSE', titulo: 'NI ESTO', titularVisible: false },
    marquesina: { ...DEFAULTS.marquesina, texto: 'Café fresco todos los días' },
  } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(html.includes('Café fresco todos los días'), 'debe rendir el texto de `marquesina.texto`');
  assert.ok(!html.includes('ESTO NO DEBE VERSE'), 'no debe rendir el eyebrow del hero — sticky nunca lo lee');
  assert.ok(!html.includes('NI ESTO'), 'no debe rendir el titulo del hero con titularVisible:false');
});

test('el texto del loop rinde DOS VECES dentro del track (cinta continua), más la 3ª aparición del `aria-label` de la sección', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, texto: 'Calidad que se nota' } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  const apariciones = html.split('Calidad que se nota').length - 1;
  assert.equal(apariciones, 3);
  const enSpans = (html.match(/<span class="pr-\[0\.5em\]">/g) || []).length;
  assert.equal(enSpans, 2);
});

// § MARQUEE-SIN-RAYA-1 — la raya (—) que separaba cada repetición se retira (decisión del owner,
// apartándose de `docs/prototipos/cafeone/index.html:149`).
// § MARQUEE-ESPACIO-MENOR-1 — gate visual del owner tras esa entrega: el hueco resultante (espacio
// de texto + spacer de 1em + `&nbsp;` + el `pr-8` fijo) se leía como un hueco. Colapsa a UN solo
// mecanismo, `pr-[0.5em]` — sin espacio de texto, sin spacer, sin `&nbsp;` — así la separación total
// es de media letra, no la suma de cuatro.
test('el loop NO rinde la raya (—), y la separación es UN solo mecanismo (`pr-[0.5em]`), no la suma de espacio+spacer+nbsp+padding', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.ok(!html.includes('—'), 'ningún guion largo debe sobrevivir en el texto del loop');
  assert.ok(!html.includes(' '), 'el `&nbsp;` del mecanismo viejo no debe sobrevivir');
  assert.ok(!html.includes('inline-block w-[1em]'), 'el spacer de 1em del mecanismo viejo no debe sobrevivir');
  const enPad = (html.match(/<span class="pr-\[0\.5em\]">/g) || []).length;
  assert.equal(enPad, 2, 'las DOS repeticiones deben llevar el padding de 0.5em');
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
// defaults.ts), así que `productoMarquesina` (§ HERO-SIN-TARJETA-Y-PDP-IMAGEN-1 — antes
// `productoSpotlight`, que caía al primer producto del catálogo) SIEMPRE devuelve `null` acá — sin
// producto que pinear, el ancestro usa el presupuesto CORTO (`claseAlturaAncestroMarquesina(false)`), no el de siempre.
// El caso CON tarjeta (§ MARQUESINA-TARJETA-SECUENCIA-1: re-derivado, ya NO 200vh) queda afirmado
// directo sobre la función pura, abajo — el mismo límite SSR de `getCatalog()`/`useEffect` que ya
// documentan los otros tests de esta sección (líneas 122-126) impide resolver un `producto` real a
// través de este harness de render.
test('SIN producto (DEFAULTS, hide-on-empty): el ancestro usa el presupuesto CORTO — no arrastra el presupuesto CON tarjeta cuando no hay tarjeta que mostrar', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.match(html, /min-h-\[calc\(100svh\+65vh\)\]/);
  assert.doesNotMatch(html, /min-h-\[calc\(100svh\+200vh\)\]/);
});

// HERO-MARQUESINA-TEST-SYNC-1 (2026-10-02) — esta aserción se quedó afirmando el presupuesto VIEJO
// (100svh+200vh) después de que § MARQUESINA-TARJETA-SECUENCIA-1 re-derivara el caso CON tarjeta a
// 100svh+100vh (GATE_RED: el `touches:` de aquel slice no incluía este archivo, así que el gate
// nunca vio la divergencia). En vez de otro literal copiado a mano —el mismo modo de falla que
// volvió a dejar esta aserción atrás—, se DERIVA el presupuesto de `UMBRAL_ENTRADA_TARJETA_MARQUESINA`
// con la MISMA fórmula que el docstring de `claseAlturaAncestroMarquesina` documenta (§ "RONDA
// SECUENCIA"/"RONDA PAUSA", `lib/animation.ts`): el `position:sticky` se despinea medio "respiro"
// —la mitad del ancho de la ventana de entrada de la tarjeta— después de que la tarjeta termina de
// entrar. Si esa ventana vuelve a cambiar, esta aserción se mueve con ella en vez de quedar rancia
// otra vez — y § MARQUESINA-TARJETA-COMO-LETRAS-1 (2026-10-02, la pausa antes de la ventana) ya lo
// ejercitó sin tocar este test: el presupuesto subió de 100vh a 140vh y la aserción sigue en verde,
// porque se deriva de la ventana real en vez de copiar el número.
//
// `Math.round` — necesario DESDE que la ventana deja de ser una fracción "limpia" (con la pausa,
// `desde`/`hasta` son decimales periódicos, § el docstring de `UMBRAL_ENTRADA_TARJETA_MARQUESINA`):
// `100/(1-pUnpin)-100` arrastra el error de redondeo de IEEE754 de ese decimal periódico y da
// `140.00000000000003`, no `140` — el MISMO ajuste que ya lleva la aserción gemela de
// `lib/animation.test.ts` ("el extra CON tarjeta se DERIVA de las ventanas…"). Sin el redondeo, esta
// aserción fallaría por un error de representación de punto flotante, no por un defecto real.
test('claseAlturaAncestroMarquesina: CON tarjeta el presupuesto SE DERIVA de UMBRAL_ENTRADA_TARJETA_MARQUESINA (el sticky se despinea medio respiro después de que la tarjeta termina de entrar) y sigue siendo MAYOR que SIN tarjeta (65vh, intacto)', () => {
  const { desde, hasta } = UMBRAL_ENTRADA_TARJETA_MARQUESINA;
  const respiro = (hasta - desde) / 2;
  const pUnpin = hasta + respiro;
  const extraConTarjetaVh = Math.round(100 / (1 - pUnpin) - 100);

  assert.equal(
    claseAlturaAncestroMarquesina(true, false),
    `min-h-[calc(100svh+${extraConTarjetaVh}vh)]`,
  );

  const sinTarjeta = claseAlturaAncestroMarquesina(false, false);
  assert.equal(sinTarjeta, 'min-h-[calc(100svh+65vh)]');

  // La relación que importa, no sólo el número: CON tarjeta sigue reservando MÁS presupuesto de
  // scroll que SIN ella — hay más contenido (la pausa + la entrada de la tarjeta + su respiro) que
  // mostrar.
  assert.ok(extraConTarjetaVh > 65, 'con tarjeta debe reservar más presupuesto que sin ella');
});

// ─── LA MEDIA CUBRE `lvh` CENTRADA — § HERO-MOVIL-SIN-FRANJA-VERDE-1 ──────────────────────────────
// El owner, desde su teléfono, con captura: «En móvil se ve como una pantalla verde detrás del video
// cuando empiezo a hacer scroll y empiezan a salir las letras» — el marco (`h-[100svh]`, sin cambios)
// y la media que lo llenaba (antes `absolute inset-0`, 100% del marco) quedaban atados al mismo
// viewport CHICO; al colapsar el chrome del navegador durante el scroll el viewport visible crece
// hacia `lvh` y el ancestro (§ "LA MECÁNICA DE STICKY") asoma por el hueco. El docstring de cabecera
// de `HeroMediaMarquesina.tsx` (el bloque con este mismo id) trae la derivación completa.

test('el marco (`<section>`) YA NO lleva `overflow-hidden` propio — se retiró para que la media pueda pintar más allá de su caja; el ANCESTRO del sticky NO lleva overflow-hidden tampoco (§ HERO-STICKY-OVERFLOW-FIX-1: rompía el sticky por especificación — un scroll container ancestro)', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  const iWrapper = html.indexOf('class="relative');
  const iSection = html.indexOf('<section');
  const claseWrapper = html.slice(iWrapper, html.indexOf('"', iWrapper + 'class="'.length) + 1);
  const claseSection = html.slice(html.indexOf('class="', iSection), html.indexOf('"', html.indexOf('class="', iSection) + 'class="'.length) + 1);
  assert.doesNotMatch(claseWrapper, /overflow-hidden|overflow-auto|overflow-scroll/, 'el <div ref={wrapperRef}> (el ancestro de un sticky) NUNCA debe llevar un overflow que cree scroll container — rompe el sticky de sus descendientes');
  assert.doesNotMatch(claseSection, /overflow-hidden/, 'la <section> (el marco pineado) ya no debe llevarlo en su propia className');
});

test('el ANCESTRO del sticky lleva `overflow-clip`, no `overflow-hidden` — recorta el excedente de la media SIN volverse scroll container (§ HERO-STICKY-OVERFLOW-FIX-1)', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  const iWrapper = html.indexOf('class="relative');
  const claseWrapper = html.slice(iWrapper, html.indexOf('"', iWrapper + 'class="'.length) + 1);
  assert.match(claseWrapper, /overflow-clip/, 'el <div ref={wrapperRef}> (el ancestro) debe llevar overflow-clip como red de seguridad que no rompe el sticky');
});

test('overflow-hidden SIGUE en el marcado UNA sola vez (vía la máscara del ticker) — el ancestro ya no lo aporta', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  const apariciones = (html.match(/overflow-hidden/g) ?? []).length;
  // Una aparición: la máscara del ticker (sin cambios). El ancestro pasó a overflow-clip y la sección nunca lo tuvo.
  assert.equal(apariciones, 1);
  const aparicionesClip = (html.match(/overflow-clip/g) ?? []).length;
  assert.equal(aparicionesClip, 1, 'overflow-clip debe aparecer exactamente una vez — sólo en el ancestro del sticky');
});

test('el `<div>` de video/imagen+velo mide `100lvh`, CENTRADO respecto al marco (`top:calc((100svh - 100lvh) / 2)`) — antes `absolute inset-0` (100% del marco, svh)', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.ok(
    html.includes('<div class="absolute inset-x-0" style="top:calc((100svh - 100lvh) / 2);height:100lvh">'),
    'el div de media debe llevar el offset centrado y la altura lvh explícitos',
  );
  assert.doesNotMatch(html, /<div class="absolute inset-0">/, 'la className vieja (100% del marco, sin el offset lvh) no debe sobrevivir');
});

test('la máscara del ticker gana `inset-x-0` (ancho acotado al marco) en vez de `left-0` a secas — ya no depende del overflow-hidden retirado de la sección', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.match(
    html,
    /class="absolute inset-x-0 top-1\/2 z-10 -translate-y-1\/2 overflow-hidden whitespace-nowrap font-playfair/,
    'la máscara debe declarar su propio ancho (inset-x-0), con su overflow-hidden propio intacto',
  );
});

// EN ESCRITORIO/SIN chrome dinámico, `svh === lvh` por definición del spec de CSS — no hay jsdom en
// este repo (§ CLAUDE.md) para evaluar `calc()` de verdad, así que la propiedad "la fórmula se anula
// (top:0, height:100%) cuando svh=lvh" no tiene un test de render que la ejercite acá; es aritmética
// de la fórmula (`(X-X)/2 = 0`), no algo que dependa de este componente. La prueba de que el
// NAVEGADOR realmente resuelve `calc((100svh - 100lvh) / 2)` a `0px` en escritorio es del gate
// visual (`verificar:nayoli:visual`, capa 3), no de este archivo.

// ─── LA VISTA PREVIA DEL PANEL — § HERO-FRASE-AL-PIE-Y-PREVIEW-1 ──────────────────────────────────
// El owner, sobre `/admin/tienda`: «la imagen de la sección "Hero de la home" no se está
// renderizando correctamente… cubre sólo una parte del marco y el resto queda en el fondo oscuro».
// MEDIDO: `VistaTiendaEnVivo` (vía `EscalaDesktop`) renderiza el alto NATURAL completo del ancestro
// (`100svh+200vh`/`100svh+65vh`) SIN scrollear, así que el "presupuesto de scroll" que el storefront
// real esconde detrás del `position:sticky` queda visible como fondo `--sf-tinta` plano bajo la
// sección pineada (sólo 1/3 o ~0.61 del total es media). En `preview`, el ancestro se colapsa a
// `h-[100svh]` — el mismo alto que la sección pineada — así que no queda tramo sobrante que pintar.

test('EN PREVIEW: el ancestro se colapsa a h-[100svh] — SIN el presupuesto de scroll, cubre el marco entero (con o sin tarjeta)', () => {
  const sinProducto = renderHeroMediaMarquesina(DEFAULTS as SiteContentData, { preview: true });
  // El discriminador es la clase del ANCESTRO (`class="relative h-[100svh]…`) — el `<section>`
  // pineado YA lleva su propio `h-[100svh]` literal siempre, con o sin preview; lo que prueba el fix
  // es que el WRAPPER (el primer `class=` del árbol) también lo lleve, en vez del `min-h-[calc(…)]`.
  assert.match(sinProducto, /class="relative h-\[100svh\]/, 'el ancestro debe colapsarse a h-[100svh]');
  assert.doesNotMatch(sinProducto, /min-h-\[calc\(100svh\+65vh\)\]/, 'sin el presupuesto corto (sin tarjeta) bajo preview');
  assert.doesNotMatch(sinProducto, /min-h-\[calc\(100svh\+200vh\)\]/, 'sin el presupuesto largo (con tarjeta) bajo preview');
});

test('FUERA de preview (SSR normal): el ancestro sigue usando el presupuesto de scroll (65vh sin tarjeta, DEFAULTS) — el storefront real no cambia', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.match(html, /min-h-\[calc\(100svh\+65vh\)\]/);
  // El discriminador es la clase del ANCESTRO (`class="relative h-[100svh]…`), no la del `<section>`
  // pineado (`class="sticky top-0 flex h-[100svh]…`) — ese literal SIEMPRE está presente, con o sin
  // preview, porque es la altura fija de la sección visible, no del ancestro con presupuesto.
  assert.doesNotMatch(html, /class="relative h-\[100svh\]/, 'sin preview, el ANCESTRO no debe colapsarse al alto corto');
});

// ─── LA FRASE AL PIE — § HERO-FRASE-AL-PIE-Y-PREVIEW-1 ────────────────────────────────────────────
// El campo (`hero.fraseAlPie`) YA existía en el modelo (`TEMAS-HERO-MEDIA-AGREGADOS-1`) pero esta
// variante nunca lo leía — sólo `HeroMedia.tsx` (la variante "media") lo rendía. Vacío → SE OMITE
// (default, byte-idéntico); con texto → aparece, ENFRENTADA al cue (bottom-right vs. bottom-left del
// cue), y SIN gatearse en preview (a diferencia del cue, que sí se omite ahí).

test('hero.fraseAlPie vacío (DEFAULTS): NO rinde el párrafo de la frase', () => {
  assert.equal(DEFAULTS.hero.fraseAlPie, '');
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, /Hay algo profundamente meditativo/);
});

test('hero.fraseAlPie con texto: rinde el párrafo, alineado a la derecha, ENFRENTADO al cue (bottom-right, no left)', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, fraseAlPie: 'Hay algo profundamente meditativo en preparar un café cultivado a 1.600 msnm.' } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(html.includes('Hay algo profundamente meditativo en preparar un café cultivado a 1.600 msnm.'));
  assert.match(html, /right-4[^"]*z-10[^"]*max-w-\[34ch\][^"]*text-right/, 'debe ir a la derecha, no a la izquierda (donde va el cue)');
});

// § HERO-FRASE-COLOR-PLENO-1 — LA CAUSA MEDIDA NO ERA LA TIPOGRAFÍA, ERA EL ROL DE COLOR. El owner
// seguía reportando la frase «con menos cuerpo que el muestrario» aun con `font-medium` ya aplicado
// (§ CROMO-NAV-EXACTO-PROTOTIPO-1). El orquestador midió: esta frase pintaba con el rol SUAVE
// (`--sf-sobre-banda-suave`, blanco translúcido ~70%) mientras el `.hero-caption` del muestrario usa
// `--text-on-inverse` — PLENO, opaco —, el MISMO rol que ya usa el texto del marquee de esta variante
// (`text-[var(--sf-sobre-banda,white)]`). Un texto translúcido se lee lavado y delgado con cualquier
// fuente. La frase pasa al rol PLENO y el peso VUELVE a regular (`font-normal`): el muestrario no
// declara peso propio en `.hero-caption`, hereda el 400 del body — el "cuerpo" que faltaba lo daba el
// color, no el peso, así que la subida de la ronda anterior se revierte.
// § EDITOR-TIENDA-BARRA-FLOTANTE-1 — hero.estilos.fraseAlPie aplica TAMBIÉN en esta variante
// (sticky), no sólo en HeroMedia: `HeroMediaMarquesina.tsx` ganó `tema` en su destructuring
// SÓLO para poder leer `tema.fuentePar` acá.
test('hero.estilos.fraseAlPie ausente (DEFAULTS): el párrafo NO lleva ningún `style` de override — byte-idéntico', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, fraseAlPie: 'Café de altura.' } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.doesNotMatch(html, /text-align/);
  assert.doesNotMatch(html, /color:var\(--sf-/);
});

test('hero.estilos.fraseAlPie con alinear/color declarados: emite su `style` sobre el párrafo', () => {
  const content = {
    ...DEFAULTS,
    hero: {
      ...DEFAULTS.hero, fraseAlPie: 'Café de altura.',
      estilos: { ...DEFAULTS.hero.estilos, fraseAlPie: { fuente: null, tamano: null, color: 'suave', alinear: 'izquierda' } },
    },
  } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.match(html, /<p[^>]*style="[^"]*text-align:left/);
  assert.match(html, /<p[^>]*style="[^"]*color:var\(--sf-texto-suave\)/);
});

// LAS TRES ZONAS NUEVAS SE APAGAN EXPLÍCITO (§ EDITOR-TIENDA-ZONAS-STICKY-TITULAR-1): sin esto, el
// default `true` de `titularVisible`/`subtituloVisible`/`ctasVisibles` haría que la zona titular
// rindiera DE PASO (su wrapper hereda `--sf-sobre-banda-suave`, igual que el cue; su CTA secundario
// usa `font-medium`), contaminando las dos aserciones GLOBALES de abajo — que son sobre la FRASE,
// no sobre la zona nueva. Apagar las tres aísla el test al elemento que afirma.
test('hero.fraseAlPie: rol PLENO (--sf-sobre-banda), NUNCA el suave translúcido — el mismo rol que ya usa el texto del marquee', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, fraseAlPie: 'Café de altura.', titularVisible: false, subtituloVisible: false, ctasVisibles: false },
  } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.match(html, /text-\[var\(--sf-sobre-banda,white\)\]/, 'debe pintar con el rol pleno, fallback white — igual que el marquee y el cue');
  assert.doesNotMatch(html, /--sf-sobre-banda-suave/, 'sin `cueDesliza` (default false) ni la zona titular (apagada acá), el único --sf-sobre-banda-suave posible era esta frase; no debe quedar rastro');
});

// § CORTE-CUERPO-FIGTREE-PESO-1: `font-normal` (literal 400, ciego al par) pasa a `sf-peso-normal`
// (`app/globals.css`, lee `--sf-peso-cuerpo`) — con 'prensa' (CORTE) rinde el peso calibrado (440); con
// cualquier otro par cae al mismo 400 de siempre (byte-idéntico). El nombre de la clase cambia; el
// COMPORTAMIENTO de "regular, no font-medium" para todo tenant que no declare peso propio, no.
test('hero.fraseAlPie: peso REGULAR (sf-peso-normal, no font-medium) — sigue a --sf-peso-cuerpo del par, 400 por defecto', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, fraseAlPie: 'Café de altura.', titularVisible: false, subtituloVisible: false, ctasVisibles: false },
  } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.match(html, /text-right[^"]*sf-peso-normal[^"]*leading-relaxed/, 'sf-peso-normal debe ir junto al resto de la tipografía de la frase');
  assert.doesNotMatch(html, /font-normal/, 'ya no es el 400 fijo de Tailwind — ahora sigue al par vía sf-peso-normal');
  assert.doesNotMatch(html, /font-medium/, 'la subida de peso de CROMO-NAV-EXACTO-PROTOTIPO-1 se revierte — la causa real era el color; la zona titular (su CTA secundario usa font-medium) está apagada acá');
});

test('hero.fraseAlPie: el tamaño sigue los DOS tokens del muestrario por breakpoint — 13px bajo 640px (--text-body-xs), 14px desde 640px (--text-body-s, = text-sm, sin cambio)', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, fraseAlPie: 'Café de altura.' } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.match(html, /text-\[13px\][^"]*sf-peso-normal/, 'la base (mobile) debe llevar los 13px medidos de --text-body-xs, que faltaban');
  assert.match(html, /sm:text-sm\b/, 'desde 640px sube a 14px (text-sm), medido de --text-body-s — sin cambio de valor, sólo se hace responsive');
});

test('hero.fraseAlPie EN PREVIEW: SIGUE rindiendo (a diferencia del cue, que se omite ahí) — es texto estático, no depende del scroll', () => {
  const html = renderHeroMediaMarquesina(
    { ...DEFAULTS, hero: { ...DEFAULTS.hero, fraseAlPie: 'Café de altura.' } } as SiteContentData,
    { preview: true },
  );
  assert.ok(html.includes('Café de altura.'), 'la frase debe verse en el cuadro compuesto de la vista previa');
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

// ─── § EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1 — el marcador editable en la variante "sticky" y en la
// banda `Marquesina.tsx` suelta (§ EDICION-INLINE.md § 2.2, punto 1 "Nodos duplicados": el MISMO
// `marquesina.texto` rinde DOS veces dentro de CADA composición para el loop sin costura, y las DOS
// composiciones leen el MISMO campo — Marquesina.tsx:111-112, HeroMediaMarquesina.tsx:841-842 al
// escribir esto). Fuera de `ModoEditorProvider` (el resto de este archivo, arriba, y toda la
// superficie pública) el contexto cae a `false` por default — CampoEditable devuelve `children` sin
// envoltorio, así que estos tests NO son nuevos huecos de byte-idéntico: son la MISMA invariante que
// ya exigen los ~40 tests de arriba, afirmada explícitamente para el campo flotante.

function contarMarcador(html: string, campo: string): number {
  const re = new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="${campo.replace(/[.]/g, '\\.')}"`, 'g');
  return (html.match(re) ?? []).length;
}

test('sticky, SIN modo editor: cero `data-editor-campo` — byte-idéntico (el contrato que ya cumple data-editor-seccion)', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, variante: 'sticky' as const, fraseAlPie: 'Tueste artesanal, lote por lote.' } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

test('sticky, CON modo editor: el ticker duplicado marca UN SOLO `<span>` con "marquesina.texto" — el gemelo queda sin marcar', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, variante: 'sticky' as const } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content, { activo: true });
  // El texto del campo rinde TRES veces — DOS en el loop sin costura (el gemelo), UNA en el
  // `aria-label` de la sección (§ el test de arriba, "más la 3ª aparición del aria-label") — y el
  // MARCADOR, una sola.
  assert.equal((html.match(new RegExp(DEFAULTS.marquesina.texto, 'g')) ?? []).length, 3);
  assert.equal(contarMarcador(html, 'marquesina.texto'), 1);
  // La ruta es de UNA línea ("texto del loop" no declara `textarea` en `tienda-secciones.ts`).
  assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="marquesina\\.texto"[^>]*${ATRIBUTO_EDITOR_LINEA}="unica"`));
});

test('sticky, CON modo editor: `hero.fraseAlPie` marca su único párrafo, `multilinea` (data-editor-linea="multiple")', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, variante: 'sticky' as const, fraseAlPie: 'Tueste artesanal, lote por lote.' } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content, { activo: true });
  assert.equal(contarMarcador(html, 'hero.fraseAlPie'), 1);
  assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="hero\\.fraseAlPie"[^>]*${ATRIBUTO_EDITOR_LINEA}="multiple"`));
});

test('sticky, CON modo editor: `hero.fraseAlPie` vacío (DEFAULTS) — el párrafo no rinde, así que tampoco su marcador', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, variante: 'sticky' as const } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content, { activo: true });
  assert.equal(contarMarcador(html, 'hero.fraseAlPie'), 0);
});

// `DEFAULTS.marquesina.visible` es `false` ("nace OFF", § CLAUDE.md) — `Marquesina.tsx` no rinde
// NADA contra los DEFAULTS crudos (`seccionEsVisible` la apaga antes de llegar a ningún campo). Para
// ejercitar el marcador hace falta `visible:true`, igual que `marquesina-banda.test.ts` (§ EDITOR-
// TIENDA-MARQUESINA-SECCION-1, sí en `touches:` de este slice) hace lo mismo.
test('Marquesina.tsx, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

// § EDITOR-TIENDA-MARQUESINA-SECCION-1: la banda suelta ya NO usa `marquesina.texto` (el campo del
// HERO) — tiene su PROPIA frase, `marquesina.fraseBanda`, con el MISMO motor de ticker
// (`MarquesinaFraseMotor`, § MarquesinaMotor.tsx) que `HeroMediaMarquesina` ya ejercita arriba.
test('Marquesina.tsx, CON modo editor: el ticker duplicado marca UN SOLO `<span>` con "marquesina.fraseBanda" — campo PROPIO de la banda, distinto del `texto` del hero', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content, { activo: true });
  // Mismo patrón que la variante sticky: DOS en el loop + UNA en el `aria-label` de la sección.
  assert.equal((html.match(new RegExp(DEFAULTS.marquesina.fraseBanda, 'g')) ?? []).length, 3);
  assert.equal(contarMarcador(html, 'marquesina.fraseBanda'), 1);
  assert.equal(contarMarcador(html, 'marquesina.texto'), 0, 'la banda suelta ya no marca el campo del hero');
});

// ─── LA ZONA «TITULAR/SUBTÍTULO/BOTÓN» — § EDITOR-TIENDA-ZONAS-STICKY-TITULAR-1 ────────────────────
//
// Revierte la Desviación 1 de EDITOR-TIENDA-ZONAS-1 (§ el docstring de cabecera de
// `HeroMediaMarquesina.tsx`, mismo id): `titularVisible`/`subtituloVisible`/`ctasVisibles` ahora
// TAMBIÉN tienen efecto bajo `hero.variante === 'sticky'`, leyendo los MISMOS campos que `media`
// (sin campos nuevos). Todo contenido ANTERIOR a este bloque que ejercita la zona por casualidad
// (el default `true` de los tres toggles) la apaga explícito para no contaminar su propia
// aserción — ver las dos excepciones arregladas arriba, § "LAS TRES ZONAS NUEVAS SE APAGAN
// EXPLÍCITO".

test('DEFAULT (titularVisible/subtituloVisible/ctasVisibles en su true de siempre): la zona rinde titulo+tituloEnfasis, subtitulo y los DOS CTA', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.ok(html.includes(DEFAULTS.hero.titulo), 'el titulo debe rendir');
  assert.ok(html.includes(DEFAULTS.hero.tituloEnfasis), 'el énfasis debe rendir junto al titulo');
  assert.ok(html.includes(DEFAULTS.hero.subtitulo), 'el subtitulo debe rendir');
  assert.ok(html.includes(DEFAULTS.hero.ctaPrimarioLabel), 'el CTA primario debe rendir');
  assert.ok(html.includes(DEFAULTS.hero.ctaSecundarioLabel), 'el CTA secundario debe rendir');
  assert.match(html, /<h2\b/, 'el titular de la zona es un <h2> — nunca el <h1> que usa HeroMedia para SU titular dominante');
});

test('titularVisible:false — sin titulo ni tituloEnfasis, pero subtitulo y CTA se conservan (apagadores independientes)', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, titularVisible: false } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(!html.includes(DEFAULTS.hero.titulo));
  assert.ok(!html.includes(DEFAULTS.hero.tituloEnfasis));
  assert.ok(html.includes(DEFAULTS.hero.subtitulo), 'subtituloVisible sigue en su default true');
  assert.ok(html.includes(DEFAULTS.hero.ctaPrimarioLabel), 'ctasVisibles sigue en su default true');
});

test('subtituloVisible:false — sin subtitulo, titulo y CTA se conservan', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, subtituloVisible: false } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(!html.includes(DEFAULTS.hero.subtitulo));
  assert.ok(html.includes(DEFAULTS.hero.titulo));
  assert.ok(html.includes(DEFAULTS.hero.ctaPrimarioLabel));
});

test('ctasVisibles:false — sin los DOS botones, titulo y subtitulo se conservan', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, ctasVisibles: false } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(!html.includes(DEFAULTS.hero.ctaPrimarioLabel));
  assert.ok(!html.includes(DEFAULTS.hero.ctaSecundarioLabel));
  assert.ok(html.includes(DEFAULTS.hero.titulo));
  assert.ok(html.includes(DEFAULTS.hero.subtitulo));
});

test('los TRES apagados a la vez: la zona entera no rinde nada de hero.titulo/subtitulo/ctaPrimarioLabel/ctaSecundarioLabel', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, titularVisible: false, subtituloVisible: false, ctasVisibles: false },
  } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(!html.includes(DEFAULTS.hero.titulo));
  assert.ok(!html.includes(DEFAULTS.hero.subtitulo));
  assert.ok(!html.includes(DEFAULTS.hero.ctaPrimarioLabel));
  assert.ok(!html.includes(DEFAULTS.hero.ctaSecundarioLabel));
  assert.doesNotMatch(html, /<h2\b/, 'sin nada que mostrar, el <h2> ni se monta');
});

// ─── NACE APAGADA EN TODA TIENDA EXISTENTE — MEDIDO contra CORTE, el único preset con 'sticky' ────

test('CORTE (Onix/Las Chamisas, el único preset con hero:"sticky") sigue declarando los tres en false — la zona nace APAGADA sin tocar themes.ts', () => {
  assert.equal(CORTE.heroTitularVisible, false);
  assert.equal(CORTE.heroSubtituloVisible, false);
  assert.equal(CORTE.heroCtasVisibles, false);
});

test('ningún OTRO preset del catálogo declara `hero: "sticky"` — el riesgo de "nace apagada" está acotado a CORTE', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.notEqual(preset.variantes.hero, 'sticky', `${preset.clave} no debería usar hero:'sticky'`);
  }
});

test('?tema=CORTE sobre Nayoli: la zona titular/subtítulo/botón NO rinde — "ninguna tienda cambia" para el único tenant real de sticky', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.hero.variante, 'sticky');
  assert.equal(conCorte.hero.titularVisible, false);
  assert.equal(conCorte.hero.subtituloVisible, false);
  assert.equal(conCorte.hero.ctasVisibles, false);

  const html = renderHeroMediaMarquesina(conCorte);
  assert.doesNotMatch(html, /<h2\b/, 'sin titularVisible, el <h2> de la zona no se monta bajo CORTE');
  assert.ok(!html.includes(DEFAULTS.hero.ctaPrimarioLabel));
});

// ─── LA POSICIÓN — la zona queda ARRIBA del cue, ambas en el MISMO wrapper absolute ──────────────

test('con titularVisible Y cueDesliza encendidos: el <h2> de la zona aparece ANTES de `data-hero-cue` en el HTML (apilados en el mismo wrapper, titular arriba)', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, cueDesliza: true } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  const iTitular = html.indexOf('<h2');
  const iCue = html.indexOf('data-hero-cue');
  assert.ok(iTitular > -1 && iCue > -1, 'los dos deben estar presentes');
  assert.ok(iTitular < iCue, 'el titular debe aparecer ANTES del cue en el documento — "sobre el indicador Desliza"');
});

test('con titularVisible encendido y cueDesliza apagado (el default): el wrapper rinde SÓLO la zona, en el mismo lugar — "en su lugar si el indicador está apagado"', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, /data-hero-cue/, 'cueDesliza sigue en su default false');
  assert.match(html, /<h2\b/, 'la zona rinde igual, sin el cue');
});

// ─── EL CTA SECUNDARIO RESPETA EL GATE DE SUSCRIPCIONES, igual que HeroMedia.tsx ──────────────────

test('ctaSecundarioLabel NO rinde si la página de suscripciones está apagada — mismo guard que HeroMedia.tsx', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, ctaSecundarioLabel: 'Suscríbete' },
    paginas: { ...DEFAULTS.paginas, suscripciones: { visible: false } },
  } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(!html.includes('Suscríbete'), 'sin la página de suscripciones, el CTA que apunta ahí no debe rendir');
  assert.ok(html.includes(DEFAULTS.hero.ctaPrimarioLabel), 'el primario no depende de ese gate');
});

// ─── SIN ANIMACIÓN DE ENTRADA — "la misma entrada de bloque que usa la leyenda del hero" ─────────

test('EN PREVIEW (movimiento reducido): la zona sigue rindiendo — texto estático, nunca depende del scroll ni de `estatico`', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData, { preview: true });
  assert.ok(html.includes(DEFAULTS.hero.titulo), 'a diferencia del cue, la zona NO se gatea por preview — es texto estático, como la leyenda');
});

// ─── EL ESTILO POR ELEMENTO (§ EDITOR-TIENDA-BARRA-FLOTANTE-1) TAMBIÉN APLICA ACÁ — MISMOS roles ──

test('hero.estilos.titulo con tamano declarado: la zona titular de sticky TAMBIÉN respeta el estilo por elemento, mismo mecanismo que HeroMedia.tsx', () => {
  const content = {
    ...DEFAULTS,
    hero: {
      ...DEFAULTS.hero,
      estilos: { ...DEFAULTS.hero.estilos, titulo: { fuente: null, tamano: 'enorme' as const, color: 'acento' as const, alinear: null } },
    },
  } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.match(html, /<h2[^>]*style="[^"]*font-size:clamp\(72px/, 'el paso "enorme" de ESTILO-ELEMENTO debe aplicar al <h2> de la zona');
  assert.match(html, /<h2[^>]*style="[^"]*color:var\(--sf-acento\)/, 'el color por rol también debe aplicar');
});

// ─── § EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1 — marquesina.estilos.texto, el seguimiento que
// EDITOR-TIENDA-BARRA-FLOTANTE-1 dejó abierto (su `touches:` no alcanzaba `MarquesinaMotor.tsx`) ───

test('DEFAULTS (marquesina.estilos.texto sin override): la máscara sigue sin ningún `color`/`font-family` de override — byte-idéntico', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, /color:var\(--sf-/, 'sin override, ningún color por rol debe emitirse en la máscara del loop');
});

test('marquesina.estilos.texto con tamano/color declarados: la MÁSCARA del loop (el `<div>` de afuera) emite el override, por encima del font-size/color literal de siempre', () => {
  const content = {
    ...DEFAULTS,
    marquesina: {
      ...DEFAULTS.marquesina,
      estilos: { ...DEFAULTS.marquesina.estilos, texto: { fuente: null, tamano: 'enorme' as const, color: 'acento' as const, alinear: null } },
    },
  } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  // El override va DESPUÉS de las claves literales en el mismo objeto `style` (§ MarquesinaMotor.tsx):
  // `font-size` termina siendo el del paso "enorme" de la escala `ticker`, no `MARQUEE_TITULO_FONT_SIZE`.
  assert.doesNotMatch(html, new RegExp(`font-size:${MARQUEE_TITULO_FONT_SIZE.replace(/[().]/g, '\\$&')}`), 'con tamano declarado, el literal de siempre debe quedar reemplazado');
  assert.match(html, /font-size:clamp\(110px/, 'el paso "enorme" de la escala `ticker` debe aplicar — NO la de "titular" (168px), que es menor que el default de hoy');
  assert.match(html, /color:var\(--sf-acento\)/, 'el color por rol debe aplicar sobre la máscara del loop');
});

test('marquesina.estilos.texto: "Por defecto" (tamano:null) sigue dando el tamaño de HOY — MARQUEE_TITULO_FONT_SIZE, sin recortar al techo de "titular"', () => {
  // La razón de ser de un tipo "ticker" PROPIO (§ ELEMENTOS_ESTILO, estilo-elemento.ts): si la
  // frase compartiera la escala de "titular", "Por defecto" seguiría dando el literal de siempre
  // (null nunca emite override) — lo que este test afirma es justamente eso, para que nadie lo lea
  // como evidencia de que daría igual compartir la escala.
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.ok(html.includes(`font-size:${MARQUEE_TITULO_FONT_SIZE}`), 'sin override, el tamaño sigue siendo el literal medido de siempre');
});
