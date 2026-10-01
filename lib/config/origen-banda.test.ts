import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import Origen from '@/components/storefront/home/Origen';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';

import {
  BANDA_IDS,
  DEFAULTS,
  REGISTRY,
  resolverSiteContent,
  seccionEsVisible,
  type SiteContentData,
} from './site-content-defaults';
import { CORTE, PATIO, mergePresetEnContent, validarPreset, presetCompleto } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

// ORIGEN-BANDA-1 (medido: ORIGEN-BANDA-CENSO-1) — grid de 2 fotos + copy + 4 pares dato editoriales
// a nivel finca + 3 contadores animados. A DIFERENCIA de spotlight (variante de `featured`, § su
// propio archivo de carril), `origen` ES miembro de `BANDA_IDS`. Este archivo afirma el modelo
// (REGISTRY/DEFAULTS), el gate de visibilidad, el cableado del preset (CORTE la enciende, los demás
// no la tocan) y el render por `renderToStaticMarkup` (sin jsdom, § CLAUDE.md) — incluida la MITAD
// verificable del contador (el gate estático; el rAF/IntersectionObserver real es capa 3, mismo
// límite que `historia-direccion-arte.test.ts` documenta para el otro motor de movimiento).
//
// LOS DEFAULTS SON GENÉRICOS Y SUS VALORES (dato*Valor/stat*) NACEN VACÍOS (§ el docstring de
// `OrigenContent`, site-content-defaults.ts) — no hay cifra fabricada que animar sin panel; por eso
// los tests del CONTADOR usan un `content` con valores explícitos, no los DEFAULTS.

function renderOrigen(content: SiteContentData, opts: { preview?: boolean } = {}): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(Origen) });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

// ─── EL MODELO ──────────────────────────────────────────────────────────────────────────────────

test('origen ES miembro de BANDA_IDS (a diferencia de spotlight), posicionada tras brandStory', () => {
  assert.equal((BANDA_IDS as readonly string[]).includes('origen'), true);
  const idx = (BANDA_IDS as readonly string[]).indexOf('origen');
  assert.equal(BANDA_IDS[idx - 1], 'brandStory');
  assert.equal(BANDA_IDS[idx + 1], 'presentaciones');
});

test('DEFAULTS.origen nace OFF (visible:false) — la banda no se enciende sola', () => {
  assert.equal(DEFAULTS.origen.visible, false);
});

test('DEFAULTS.origen: los LABELS de los 4 datos tienen texto; los VALORES y los 3 stats nacen VACÍOS — nada fabricado', () => {
  for (const label of [DEFAULTS.origen.dato1Label, DEFAULTS.origen.dato2Label, DEFAULTS.origen.dato3Label, DEFAULTS.origen.dato4Label]) {
    assert.notEqual(label.trim(), '');
  }
  for (const valor of [DEFAULTS.origen.dato1Valor, DEFAULTS.origen.dato2Valor, DEFAULTS.origen.dato3Valor, DEFAULTS.origen.dato4Valor]) {
    assert.equal(valor, '');
  }
  for (const campo of [
    DEFAULTS.origen.statNumero1, DEFAULTS.origen.statEtiqueta1,
    DEFAULTS.origen.statNumero2, DEFAULTS.origen.statEtiqueta2,
    DEFAULTS.origen.statNumero3, DEFAULTS.origen.statEtiqueta3,
  ]) {
    assert.equal(campo, '');
  }
});

test('REGISTRY.origen: ocultable, sin variantes, con los 2 campos-imagen declarados para el borrado de blobs', () => {
  assert.equal(REGISTRY.origen.ocultable, true);
  assert.equal(REGISTRY.origen.variantes, undefined);
  assert.equal(REGISTRY.origen.repeater, undefined);
  assert.deepEqual(REGISTRY.origen.imagenes, ['imagen1', 'imagen2']);
});

test('REGISTRY.origen: los 4 LABELS son requeridos; los 4 VALORES y los 6 campos de stat son opcionales', () => {
  const c = REGISTRY.origen.campos;
  assert.equal(c.dato1Label, 'requerido');
  assert.equal(c.dato1Valor, 'opcional');
  assert.equal(c.statNumero1, 'opcional');
  assert.equal(c.statEtiqueta1, 'opcional');
});

test('sin fila (Nayoli), origen resuelve OFF — DEFAULTS y el gate coinciden', () => {
  const resuelto = resolverSiteContent({});
  assert.deepEqual(resuelto.origen, DEFAULTS.origen);
  assert.equal(seccionEsVisible(REGISTRY.origen, resuelto.origen), false);
});

test('con visible explícito en true, la sección deja de ocultarse — la garantía de arriba es del DEFAULT, no de un `ocultable:false`', () => {
  const resuelto = resolverSiteContent({ origen: { visible: true } });
  assert.equal(resuelto.origen.visible, true);
  assert.equal(seccionEsVisible(REGISTRY.origen, resuelto.origen), true);
});

// ─── EL RENDER — LA INVARIANTE: Nayoli queda BYTE-IDÉNTICA ─────────────────────────────────────

test('LA INVARIANTE: Nayoli (resolverSiteContent({}), sin fila) rinde la banda VACÍA — ni un nodo', () => {
  const html = renderOrigen(resolverSiteContent({}));
  assert.equal(html, '');
});

test('con `origen.visible:true` y los DEFAULTS (sin valores cargados): rinde el copy, pero SIN lista de datos ni contadores — hide-on-empty', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  assert.ok(html.includes(DEFAULTS.origen.titulo));
  assert.ok(html.includes(DEFAULTS.origen.lede));
  assert.ok(!html.includes('<dl'), 'sin un solo dato con valor, el <dl> entero no debe rendir');
  assert.ok(!html.includes(DEFAULTS.origen.dato1Label), 'un label sin valor tampoco aparece — el par se omite completo');
});

// ─── LAS DOS FOTOS — gap y desfase responsive, medidos contra `.origen-media` del prototipo ────────
//
// `css/app.css:584,589` (base, ≥641px): gap 20px (`--space-5`), desfase del primer marco 48px
// (`--space-12`). `css/app.css:1013-1014` (`@media max-width:640px`): gap 12px (`--space-3`), desfase
// 32px (`--space-8`). Acá vivían FIJOS en 16px/32px siempre (sin variación por ancho) — las fotos
// quedaban menos escalonadas que en el prototipo (§ PARIDAD-CAFE-Y-ORIGEN-1).

test('la grilla de fotos usa gap-3 (12px, mobile) con sm:gap-5 (20px, ≥640px) — ya NO gap-4 (16px) fijo', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  assert.match(html, /class="grid grid-cols-2 gap-3 sm:gap-5 items-start"/);
  assert.doesNotMatch(html, /class="grid grid-cols-2 gap-4 items-start"/);
});

test('el PRIMER marco de foto lleva mt-8 (32px, mobile) con sm:mt-12 (48px, ≥640px) — ya NO mt-8 fijo siempre', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  assert.match(html, /class="relative aspect-\[2\/3\] overflow-hidden sf-radio-imagen sf-sombra-imagen mt-8 sm:mt-12"/);
});

test('el SEGUNDO marco de foto sigue SIN desfase — sólo el primero (first-child, como en el prototipo) se empuja', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  assert.match(html, /class="relative aspect-\[2\/3\] overflow-hidden sf-radio-imagen sf-sombra-imagen"/, 'debe existir un marco SIN clases de margen (el segundo)');
});

// ─── EL MARCO PASA A 2/3 — MÁS ALARGADO QUE EL 3/4 DEL PROTOTIPO ─────────────────────────────────
//
// § ORIGEN-FOTOS-REVELADO-Y-CONTEO-1: decisión del orquestador sobre "más alargado" que el 3:4
// MEDIDO del prototipo (`css/app.css:586`, `ORIGEN-DATOS-EXACTO-1` no lo tocó — esa tanda midió
// tipografía/espaciado, no el aspect-ratio). Es la ÚNICA cifra de este slice que NO viene del
// prototipo; el resto (escalonado, conteo) sí.

test('el marco de foto es aspect-[2/3] — ya NO aspect-[3/4] (el del prototipo, más cuadrado)', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  assert.doesNotMatch(html, /aspect-\[3\/4\]/, 'no debe quedar ningún marco con la proporción vieja');
  const marcos = html.match(/aspect-\[2\/3\]/g) ?? [];
  assert.equal(marcos.length, 2, 'las DOS figuras deben usar el marco alargado');
});

// ─── EL ROL DE FORMA "IMAGEN" — cada figura consume `sf-radio-imagen`/`sf-sombra-imagen`, nunca
// el `rounded-2xl` crudo (§ ORIGEN-RADIO-SOMBRA-IMAGEN-1: mismo defecto que el collage de Historia,
// § HISTORIA-COLLAGE-COMO-PROTOTIPO-1 — `rounded-2xl` compila al MISMO token que 'recta' pisa a 0
// para botones/tarjetas, así que bajo CORTE las fotos salían con esquinas rectas y sin sombra) ──

test('las DOS figuras de foto usan el rol de forma imagen (sf-radio-imagen/sf-sombra-imagen) — ya NO rounded-2xl crudo', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  const figuras = html.match(/class="relative aspect-\[2\/3\] overflow-hidden [^"]*"/g) ?? [];
  assert.equal(figuras.length, 2, 'deben existir exactamente dos figuras de foto');
  for (const figura of figuras) {
    assert.match(figura, /\bsf-radio-imagen\b/);
    assert.match(figura, /\bsf-sombra-imagen\b/);
    assert.doesNotMatch(figura, /\brounded-2xl\b/);
  }
});

// ─── LA LISTA DE DATOS — filetes finos, medidos contra `.spec-list`/`dt`/`dd` del prototipo ──────
//
// `css/app.css:591-599` — MEDIDO por computed-style contra el prototipo real (§ ORIGEN-DATOS-
// EXACTO-1, no derivado de la hoja a ojo): la fila es `py-4` (16px, `--space-4`) SIN
// `items-center` (el prototipo no fija `align-items`; el computado da `normal`); `dt` lleva
// `tracking-[0.11em]` (1.32px medidos a 12px, `--tracking-eyebrow`); `dd` es `text-base` (16px,
// `--text-body-m`) en `var(--sf-texto)` (el rol `--text-body`, NO `--sf-tinta` — ése es
// `--text-heading`, el rol del h2/los contadores).

test('la fila de un dato usa py-4 (16px) SIN items-center — antes era py-3 (12px) con items-center', () => {
  const content = {
    ...DEFAULTS,
    origen: { ...DEFAULTS.origen, visible: true, dato1Valor: '1.500 – 1.800 msnm' },
  } as SiteContentData;
  const html = renderOrigen(content);
  // El match EXACTO de la clase de la fila ya certifica la ausencia de `items-center`/`py-3`
  // (una clase distinta no matchearía) — un `doesNotMatch` global sería FALSO POSITIVO acá: el
  // grid EXTERNO de fotos+copy (`grid-cols-1 lg:grid-cols-2 … items-center`, línea de arriba)
  // legítimamente lleva `items-center` para OTRA cosa (centrar fotos y copy verticalmente).
  assert.match(html, /class="flex justify-between gap-6 py-4 border-b border-\[var\(--sf-linea\)\]"/);
});

test('el dt (label) lleva tracking-[0.11em] — antes era tracking-wide (0.025em, un tercio de lo medido)', () => {
  const content = {
    ...DEFAULTS,
    origen: { ...DEFAULTS.origen, visible: true, dato1Valor: '1.500 – 1.800 msnm' },
  } as SiteContentData;
  const html = renderOrigen(content);
  assert.match(html, /class="text-\[var\(--sf-texto-suave\)\] text-xs uppercase tracking-\[0\.11em\]"/);
  assert.doesNotMatch(html, /tracking-wide/);
});

test('el dd (valor) es text-base (16px) en var(--sf-texto) — antes era text-sm (14px) en var(--sf-tinta)', () => {
  const content = {
    ...DEFAULTS,
    origen: { ...DEFAULTS.origen, visible: true, dato1Valor: '1.500 – 1.800 msnm' },
  } as SiteContentData;
  const html = renderOrigen(content);
  assert.match(html, /class="text-\[var\(--sf-texto\)\] text-base text-right m-0"/);
});

test('con datos y stats CARGADOS (contenido explícito, no los DEFAULTS): la lista y los 3 contadores SÍ rinden', () => {
  const content = {
    ...DEFAULTS,
    origen: {
      ...DEFAULTS.origen,
      visible: true,
      dato1Valor: '1.500 – 1.800 msnm',
      dato2Valor: 'Caturra y Colombia',
      statNumero1: '1600', statEtiqueta1: 'msnm promedio',
      statNumero2: '12', statEtiqueta2: 'hectáreas sembradas',
      statNumero3: '52', statEtiqueta3: 'años de tradición',
    },
  } as SiteContentData;
  const html = renderOrigen(content);
  assert.ok(html.includes(DEFAULTS.origen.dato1Label));
  assert.ok(html.includes('1.500 – 1.800 msnm'));
  assert.ok(html.includes(DEFAULTS.origen.dato2Label));
  assert.ok(!html.includes(DEFAULTS.origen.dato3Label), 'dato3 sin valor sigue omitido aunque dato1/2 tengan');
  for (const etiqueta of ['msnm promedio', 'hectáreas sembradas', 'años de tradición']) {
    assert.ok(html.includes(etiqueta), `falta la etiqueta "${etiqueta}"`);
  }
});

// ─── EL CONTADOR — el gate ESTÁTICO (§ lib/animation.test.ts para la matemática pura) ────────────
//
// LO QUE SE PUEDE AFIRMAR SIN NAVEGADOR (mismo límite que `historia-direccion-arte.test.ts`): el
// PROXY de movimiento reducido es la VISTA PREVIA (`PreviewProvider`) — las dos razones colapsan al
// MISMO `estatico` en `Origen.tsx`/`useContadorAnimado`, así que ejercer una prueba la otra.
// `prefers-reduced-motion` en tiempo real depende de `matchMedia`, que no existe en este carril.

const CONTENT_CON_STATS = {
  ...DEFAULTS,
  origen: {
    ...DEFAULTS.origen,
    visible: true,
    statNumero1: '1600', statEtiqueta1: 'msnm promedio',
    statNumero2: '12', statEtiqueta2: 'hectáreas sembradas',
    statNumero3: '52', statEtiqueta3: 'años de tradición',
  },
} as SiteContentData;

test('EN PREVIEW (proxy de movimiento reducido): el contador nace YA en su valor final, "1.600" — nunca en "0"', () => {
  const html = renderOrigen(CONTENT_CON_STATS, { preview: true });
  assert.ok(html.includes('1.600'), 'statNumero1 ("1600") debe rendir formateado ya en su valor final');
  assert.ok(html.includes('>12<'), 'statNumero2 debe rendir "12" ya en su valor final');
  assert.ok(html.includes('>52<'), 'statNumero3 debe rendir "52" ya en su valor final');
});

test('SIN preview (SSR, sin IntersectionObserver real): los tres contadores arrancan en "0" — el rAF no corrió', () => {
  const html = renderOrigen(CONTENT_CON_STATS);
  const ceros = html.match(/>0</g) || [];
  assert.equal(ceros.length, 3, 'las TRES estadísticas deben arrancar en 0 sin scroll/observer real');
  assert.ok(!html.includes('1.600'), 'sin el gate estático, el primer render no debe mostrar el valor final');
});

test('un `statNumeroN` vacío se OMITE (junto a su etiqueta) — nunca un "0" fabricado', () => {
  const content = {
    ...DEFAULTS,
    origen: { ...DEFAULTS.origen, visible: true, statNumero1: '', statEtiqueta1: 'Sin dato' },
  } as SiteContentData;
  const html = renderOrigen(content);
  assert.ok(!html.includes('Sin dato'), 'un stat sin número no debe rendir ni su etiqueta');
});

test('un `statNumeroN` no numérico (basura) tampoco se anima ni rompe — el filtro de "tiene valor" lo deja pasar, pero se muestra TAL CUAL', () => {
  const content = {
    ...DEFAULTS,
    origen: { ...DEFAULTS.origen, visible: true, statNumero1: 'N/D', statEtiqueta1: 'Estado' },
  } as SiteContentData;
  const html = renderOrigen(content);
  assert.ok(html.includes('N/D'), 'un valor no-numérico se muestra literal, no se descarta');
  assert.ok(html.includes('Estado'));
});

// ─── LOS CONTADORES — gap responsive y tipografía, medidos contra `.stats`/`.stat b`/`.stat span` ──
//
// MEDIDO por computed-style contra el prototipo real (§ ORIGEN-DATOS-EXACTO-1, no derivado de la
// hoja a ojo): `.stats` es gap 24px bajo 640px (`--space-6`) y 32px desde 641px (`--space-8`) —
// antes era `gap-8` fijo siempre; `.stat b` es 40px FIJO en TODO ancho (`--text-display-m`, sin
// clamp — no es `--text-display-l`), line-height 39.2px (`leading-[0.98]`) y letter-spacing -0.6px
// (`tracking-[-0.015em]`) — antes `text-4xl sm:text-5xl` variaba 36/48px; `.stat span` es
// text-base (16px) — antes text-sm (14px); y el texto se queda a la IZQUIERDA en TODO ancho — el
// computado da `start` a 1280px y `left` a 390px, NUNCA centrado (`sm:text-center` era el error).

test('la rejilla de contadores usa gap-6 (24px, mobile) con sm:gap-8 (32px, ≥640px) — ya NO gap-8 fijo', () => {
  const html = renderOrigen(CONTENT_CON_STATS);
  assert.match(html, /class="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mt-16 pt-12 border-t border-\[var\(--sf-linea\)\]"/);
});

test('el número del contador es text-\\[40px\\] fijo con leading-[0.98] y tracking-[-0.015em] — ya NO text-4xl sm:text-5xl', () => {
  const html = renderOrigen(CONTENT_CON_STATS);
  assert.match(
    html,
    /class="block font-playfair text-\[40px\] leading-\[0\.98\] tracking-\[-0\.015em\] font-normal text-\[var\(--sf-tinta\)\]"/,
  );
  assert.doesNotMatch(html, /text-4xl sm:text-5xl/);
});

test('la etiqueta del contador es text-base (16px) — ya NO text-sm (14px)', () => {
  const html = renderOrigen(CONTENT_CON_STATS);
  assert.match(html, /class="block mt-2 text-base text-\[var\(--sf-texto-suave\)\]"/);
});

test('el contador queda a la IZQUIERDA en todo ancho — ya NO sm:text-center (el prototipo no centra a ningún ancho)', () => {
  const html = renderOrigen(CONTENT_CON_STATS);
  assert.match(html, /class="text-left"/);
  assert.doesNotMatch(html, /text-center/);
});

// ─── EL REVELADO ESCALONADO — § ORIGEN-FOTOS-REVELADO-Y-CONTEO-1, § ORIGEN-TEXTO-POR-BLOQUE-1 ────
//
// El gate del owner: «los datos deberían ir apareciendo progresivamente, no cargar de un golpe; los
// números deberían cargar como en el muestrario, como si estuvieran aumentando». Framer-motion
// hornea el estado `hidden` como estilo inline en el SSR (verificado por ejecución:
// `renderToStaticMarkup` de un `motion.div`/`motion.p`/`motion.h2` con `initial="hidden"` da
// `style="opacity:0;transform:translateY(24px)"` para `fadeUp` y `style="opacity:0;
// transform:translateY(30%)"` para `fadeUpCascadaBloque`, § `lib/animation.ts` — sin preview/
// reduced-motion, el HTML nace oculto hasta que JS + el `IntersectionObserver` de `whileInView` lo
// revele), así que estos DOS strings son el discriminador entre las DOS familias de reveal: fotos/
// datos/cifras (`fadeUp`, 24px) y los TRES bloques de texto (`fadeUpCascadaBloque`, 30%,
// § ORIGEN-TEXTO-POR-BLOQUE-1 — reemplaza la cascada POR PALABRA de ORIGEN-TEXTO-EN-CASCADA-1, que
// llegó a 39 `motion.span` ocultos por los 2+8+29 tokens de eyebrow/título/párrafo; ahora son
// SIEMPRE 3, uno por bloque, sin importar cuántas palabras tenga cada texto).
//
// El conteo total: 2 fotos + 3 bloques de texto (eyebrow+título+párrafo) + 4 datos + 3 cifras = 12.

const CONTENT_ORIGEN_COMPLETO = {
  ...DEFAULTS,
  origen: {
    ...DEFAULTS.origen,
    visible: true,
    dato1Valor: '1.500 – 1.800 msnm',
    dato2Valor: 'Caturra y Colombia',
    dato3Valor: 'Lavado, secado al sol',
    dato4Valor: 'Marzo – junio',
    statNumero1: '1600', statEtiqueta1: 'msnm promedio',
    statNumero2: '12', statEtiqueta2: 'hectáreas sembradas',
    statNumero3: '52', statEtiqueta3: 'años de tradición',
  },
} as SiteContentData;

test('SIN preview: 9 nodos fadeUp(24px) ocultos — 2 fotos + 4 datos + 3 cifras, cada uno su PROPIO hijo', () => {
  const html = renderOrigen(CONTENT_ORIGEN_COMPLETO);
  const ocultos = html.match(/style="opacity:0;transform:translateY\(24px\)"/g) ?? [];
  assert.equal(ocultos.length, 9, 'fotos(2) + datos(4) + cifras(3) = 9 revelados independientes con fadeUp');
});

test('SIN preview: 3 bloques de texto (fadeUpCascadaBloque, 30%) ocultos — eyebrow + título + párrafo, SIEMPRE 3 sin importar la cantidad de palabras', () => {
  const html = renderOrigen(CONTENT_ORIGEN_COMPLETO);
  const ocultos = html.match(/style="opacity:0;transform:translateY\(30%\)"/g) ?? [];
  assert.equal(ocultos.length, 3, 'eyebrow + título + párrafo = 3, cada uno UN bloque entero');
});

test('EN PREVIEW: los 12 (9 fadeUp + 3 bloques de texto) nacen YA visibles (opacity:1) — nunca ocultos esperando un scroll que el editor no dispara', () => {
  const html = renderOrigen(CONTENT_ORIGEN_COMPLETO, { preview: true });
  assert.equal(html.match(/style="opacity:0/g), null, 'ningún nodo debe quedar oculto en preview');
  const visibles = html.match(/style="opacity:1;transform:none"/g) ?? [];
  assert.equal(visibles.length, 12, 'fotos(2) + datos(4) + cifras(3) + bloques de texto(3) = 12');
});

test('con SÓLO 2 datos y sin stats: 2 fotos + 2 datos = 4 ocultos fadeUp — el conteo sigue la CANTIDAD real, no un tope fijo', () => {
  const content = {
    ...DEFAULTS,
    origen: { ...DEFAULTS.origen, visible: true, dato1Valor: '1.500 – 1.800 msnm', dato2Valor: 'Caturra y Colombia' },
  } as SiteContentData;
  const html = renderOrigen(content);
  const ocultos = html.match(/style="opacity:0;transform:translateY\(24px\)"/g) ?? [];
  assert.equal(ocultos.length, 4);
  const ocultosTexto = html.match(/style="opacity:0;transform:translateY\(30%\)"/g) ?? [];
  assert.equal(ocultosTexto.length, 3, 'los 3 bloques de texto no dependen de cuántos datos/cifras haya');
});

// ─── `TextoEnCascada` — a11y, no-JS y la pieza como unidad (ya NO hay palabras) ──────────────────

test('eyebrow/título/párrafo YA NO llevan `aria-label` — sin tokenizar, el propio nodo ya contiene el texto completo', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  assert.ok(!html.includes('aria-label='), 'ningún nodo de Origen debe llevar aria-label — ya no hace falta el rodeo de accesibilidad de la cascada por palabra');
});

test('el título rinde como UN SOLO bloque — el texto completo dentro de su propio `<h2>`, sin partir en palabras', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  const idxH2 = html.indexOf('<h2');
  const idxFinH2 = html.indexOf('</h2>');
  const trozoH2 = html.slice(idxH2, idxFinH2);
  assert.ok(trozoH2.includes(DEFAULTS.origen.titulo), 'el texto completo debe vivir en el propio h2, no partido en nodos');
  assert.match(trozoH2, /class="sf-cascada-bloque[^"]*"/);
  assert.ok(!trozoH2.includes('aria-hidden'), 'sin tokenizar no hace falta ocultar nada del contenido real al lector de pantalla');
});

test('EN PREVIEW: el título también nace YA visible (opacity:1) — mismo gate que preview, como UN solo nodo', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content, { preview: true });
  const idxH2 = html.indexOf('<h2');
  const idxFinH2 = html.indexOf('</h2>');
  const trozoH2 = html.slice(idxH2, idxFinH2);
  assert.ok(trozoH2.includes(DEFAULTS.origen.titulo));
  assert.match(trozoH2, /class="sf-cascada-bloque[^"]*" style="opacity:1;transform:none"/);
});

test('las TRES piezas (eyebrow, título, párrafo) llevan la clase `sf-cascada-bloque` — una por pieza, no una por palabra', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  const piezas = html.match(/class="sf-cascada-bloque/g) ?? [];
  assert.equal(piezas.length, 3, 'eyebrow + título + párrafo');
});

test('SIN JS, el texto se ve completo — cada `TextoEnCascada` emite su `<noscript>` con la regla que fuerza opacidad 1 sobre `.sf-cascada-bloque`', () => {
  const content = { ...DEFAULTS, origen: { ...DEFAULTS.origen, visible: true } } as SiteContentData;
  const html = renderOrigen(content);
  const noscripts = html.match(/<noscript><style>\.sf-cascada-bloque\{opacity:1!important;transform:none!important\}<\/style><\/noscript>/g) ?? [];
  assert.equal(noscripts.length, 3, 'eyebrow + título + párrafo, cada uno con su propia regla (misma regla, repetida)');
});

// ─── CORTE la enciende; los demás presets no tocan `content.origen` ─────────────────────────────

test('CORTE declara bandasVisibles.origen y le asigna esquema "crema" — sigue validando COMPLETO', () => {
  assert.equal(CORTE.bandasVisibles?.origen, true);
  assert.equal(CORTE.esquemas.origen, 'crema');
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('mergePresetEnContent(_, CORTE): enciende origen.visible — si no, el slot quedaría en el orden y en blanco', () => {
  const despues = mergePresetEnContent({ ...DEFAULTS }, CORTE);
  const origen = despues.origen as Record<string, unknown>;
  assert.equal(origen.visible, true);
});

test('mergePresetEnContent(_, CORTE): preserva cualquier copy/dato que el dueño ya hubiera puesto, sólo enciende `visible`', () => {
  const antes = { ...DEFAULTS, origen: { ...DEFAULTS.origen, titulo: 'Mi propio título', dato1Valor: '2.000 msnm' } };
  const despues = mergePresetEnContent(antes as unknown as Record<string, unknown>, CORTE);
  const origen = despues.origen as Record<string, unknown>;
  assert.equal(origen.visible, true);
  assert.equal(origen.titulo, 'Mi propio título');
  assert.equal(origen.dato1Valor, '2.000 msnm');
});

test('mergePresetEnContent NO toca origen para un preset que NO declara bandasVisibles.origen (PATIO)', () => {
  assert.equal(PATIO.bandasVisibles?.origen, undefined);
  const despues = mergePresetEnContent({ ...DEFAULTS }, PATIO);
  assert.deepEqual(despues.origen, DEFAULTS.origen);
});

// ─── EL MIRADOR (`?tema=CORTE`) — la vista de sólo-lectura que ejerce la cadena completa ─────────

test('sin ?tema= (mirador con clave undefined): Nayoli no cambia — origen sigue sin renderizar', () => {
  const nayoli = resolverSiteContent({});
  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli);
  assert.equal(renderOrigen(sinTema), '');
});

test('?tema=CORTE sobre Nayoli: origen pasa a visible y el render trae el copy de los DEFAULTS (Nayoli no tiene fila propia; mergePresetEnContent nunca escribe texto de sección)', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.origen.visible, true);

  const html = renderOrigen(conCorte);
  assert.ok(html !== '');
  assert.ok(html.includes(DEFAULTS.origen.titulo));
  // Consecuencia MEDIDA y aceptada (§ el docstring de `OrigenContent`): sin panel para cargar datos
  // reales, la lista y los contadores rinden vacíos bajo CORTE — mismo comportamiento que
  // `featured·spotlight` hoy sin catálogo real (§ spotlight-cableado.test.ts).
  assert.ok(!html.includes('<dl'), 'sin valores cargados, la lista de datos no rinde ni bajo CORTE');
});

test('?tema=CORTE NO toca ningún texto/dato de la sección — sólo `visible` (coherente con la garantía general del mirador)', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.origen.titulo, nayoli.origen.titulo);
  assert.equal(conCorte.origen.lede, nayoli.origen.lede);
  assert.equal(conCorte.origen.dato1Valor, nayoli.origen.dato1Valor);
});
