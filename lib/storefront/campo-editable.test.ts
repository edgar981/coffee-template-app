import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsearRutaCampo, fusionCampoEditable, estiloCampoFlotante, ATRIBUTO_EDITOR_CAMPO_IMAGEN } from './campo-editable';

import HeroCurtina from '@/components/storefront/home/HeroCurtina';
import HeroFicha from '@/components/storefront/home/HeroFicha';
import HeroMedia from '@/components/storefront/home/HeroMedia';
import HeroMediaMarquesina from '@/components/storefront/home/HeroMediaMarquesina';
import Marquesina from '@/components/storefront/home/Marquesina';
import BrandStoryColumnas from '@/components/storefront/home/BrandStoryColumnas';
import BrandStoryCentrada from '@/components/storefront/home/BrandStoryCentrada';
import Origen from '@/components/storefront/home/Origen';
import GrindChooserMosaico from '@/components/storefront/home/GrindChooserMosaico';
import GrindChooserIndice from '@/components/storefront/home/GrindChooserIndice';
import GrindChooserRiel from '@/components/storefront/home/GrindChooserRiel';
import SubscriptionCTABloque from '@/components/storefront/home/SubscriptionCTABloque';
import SubscriptionCTALinea from '@/components/storefront/home/SubscriptionCTALinea';
import TestimonialSection from '@/components/storefront/home/TestimonialSection';
import NosotrosHistoria from '@/components/storefront/nosotros/NosotrosHistoria';
import NosotrosGaleria from '@/components/storefront/nosotros/NosotrosGaleria';
import NosotrosCierre from '@/components/storefront/nosotros/NosotrosCierre';
import SuscripcionPlanes from '@/components/storefront/suscripciones/SuscripcionPlanes';
import SuscripcionPasos from '@/components/storefront/suscripciones/SuscripcionPasos';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { ModoEditorProvider } from '@/components/storefront/ModoEditor';
import { CartProvider } from '@/lib/cartStore';
import { ATRIBUTO_EDITOR_CAMPO, ATRIBUTO_EDITOR_LINEA } from '@/lib/admin/editor-iframe';
import { DEFAULTS, type SiteContentData } from '@/lib/config/site-content-defaults';

// Capa 1 del campo editable (§ EDITOR-TIENDA-CAMPO-EDITABLE-1). Puro, sin DOM/React/postMessage —
// lo que se afirma es el parseo de la ruta que `CampoEditable` marca en el DOM, la fusión que
// produce el parcial de `cambiar()`, y la forma del `style` del overlay.
//
// § EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1 agrega una SEGUNDA mitad, al final de este archivo: la
// APLICACIÓN real de `CampoEditable` a las TRES variantes del hero sin ticker (curtina/ficha/
// media — la cuarta, "sticky", comparte el campo `marquesina.texto` con `Marquesina.tsx` y vive en
// `lib/config/hero-marquesina.test.ts`, que ya tenía la infraestructura de render para esa
// composición). Esa mitad SÍ renderiza (`renderToStaticMarkup`), porque lo que hay que afirmar no es
// la lógica pura sino que el componente REAL —el que ve el visitante— queda byte-idéntico fuera del
// modo editor y marca el nodo correcto dentro de él; una aserción sobre `fusionCampoEditable` a
// secas no vería un campo que el JSX de la sección se olvidó de envolver.

test('parsearRutaCampo: plano — el primer punto separa sección y campo', () => {
  assert.deepEqual(parsearRutaCampo('hero.titulo'), { seccion: 'hero', campo: 'titulo' });
});

test('parsearRutaCampo: de ítem de repeater — el resto queda del lado del campo', () => {
  assert.deepEqual(parsearRutaCampo('testimonials.items.0.text'), { seccion: 'testimonials', campo: 'items.0.text' });
});

test('parsearRutaCampo: rechaza rutas sin sección, sin campo, o sin punto', () => {
  assert.equal(parsearRutaCampo('titulo'), null);
  assert.equal(parsearRutaCampo('hero.'), null);
  assert.equal(parsearRutaCampo('.titulo'), null);
  assert.equal(parsearRutaCampo(''), null);
});

test('fusionCampoEditable: campo PLANO — un parcial de una sola clave', () => {
  assert.deepEqual(fusionCampoEditable({ titulo: 'Viejo', subtitulo: 'Sin tocar' }, 'titulo', 'Nuevo'), {
    titulo: 'Nuevo',
  });
});

test('fusionCampoEditable: campo plano con nombre vacío (ruta mal formada) se ignora', () => {
  assert.equal(fusionCampoEditable({}, '', 'x'), null);
});

test('fusionCampoEditable: ítem de repeater — reemplaza SÓLO ese subcampo de ESE ítem', () => {
  const form = { items: [{ name: 'Ana', text: 'Viejo' }, { name: 'Luis', text: 'Otro' }] };
  const resultado = fusionCampoEditable(form, 'items.0.text', 'Nuevo texto');
  assert.deepEqual(resultado, { items: [{ name: 'Ana', text: 'Nuevo texto' }, { name: 'Luis', text: 'Otro' }] });
  // NO muta el array/ítem originales — mismo criterio de inmutabilidad que `cambiar`.
  assert.deepEqual(form.items[0], { name: 'Ana', text: 'Viejo' });
});

test('fusionCampoEditable: el segundo ítem del repeater no se toca al editar el primero', () => {
  const form = { items: [{ text: 'A' }, { text: 'B' }] };
  const resultado = fusionCampoEditable(form, 'items.0.text', 'A editado');
  assert.equal((resultado!.items as unknown[])[1], form.items[1]); // misma referencia, no tocado
});

test('fusionCampoEditable: índice fuera de rango se ignora (null)', () => {
  const form = { items: [{ text: 'A' }] };
  assert.equal(fusionCampoEditable(form, 'items.5.text', 'x'), null);
});

test('fusionCampoEditable: items ausente o no-array se ignora (sección sin cargar / no es repeater)', () => {
  assert.equal(fusionCampoEditable({}, 'items.0.text', 'x'), null);
  assert.equal(fusionCampoEditable({ items: 'no-es-array' }, 'items.0.text', 'x'), null);
});

test('fusionCampoEditable: un ítem que no es objeto (array/null/primitivo) se ignora', () => {
  assert.equal(fusionCampoEditable({ items: [null] }, 'items.0.text', 'x'), null);
  assert.equal(fusionCampoEditable({ items: [['no-objeto']] }, 'items.0.text', 'x'), null);
  assert.equal(fusionCampoEditable({ items: ['string'] }, 'items.0.text', 'x'), null);
});

test('fusionCampoEditable: una forma que no es plana ni items.N.campo se ignora', () => {
  assert.equal(fusionCampoEditable({}, 'items.0', 'x'), null); // sólo dos partes
  assert.equal(fusionCampoEditable({}, 'otraCosa.0.campo', 'x'), null); // no empieza con 'items'
  assert.equal(fusionCampoEditable({ items: [{}] }, 'items.0.a.b', 'x'), null); // cuatro partes
});

test('fusionCampoEditable: índice negativo o no entero se ignora', () => {
  const form = { items: [{ text: 'A' }] };
  assert.equal(fusionCampoEditable(form, 'items.-1.text', 'x'), null);
  assert.equal(fusionCampoEditable(form, 'items.1.5.text', 'x'), null);
});

test('estiloCampoFlotante: geometría ABSOLUTA (documento, § EDITOR-TIENDA-CAMPO-ANCLADO-1) + tipografía spread (incluido whiteSpace) + z-index al tope + sin scrollbar', () => {
  const estilo = estiloCampoFlotante(
    { top: 10, left: 20, width: 300, height: 40 },
    {
      fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', fontStyle: 'normal',
      lineHeight: '24px', letterSpacing: '0px', textAlign: 'left', textTransform: 'none',
      whiteSpace: 'normal', color: 'rgb(0, 0, 0)', padding: '0px',
    },
  );
  assert.equal(estilo.position, 'absolute');
  assert.equal(estilo.top, 10);
  assert.equal(estilo.left, 20);
  assert.equal(estilo.width, 300);
  assert.equal(estilo.height, 40);
  assert.equal(estilo.fontFamily, 'Inter');
  assert.equal(estilo.whiteSpace, 'normal');
  assert.equal(estilo.color, 'rgb(0, 0, 0)');
  assert.equal(estilo.background, 'transparent');
  assert.equal(estilo.border, 'none');
  assert.equal(estilo.boxSizing, 'border-box');
  assert.equal(estilo.overflow, 'hidden');
  assert.equal(estilo.zIndex, 2147483647);
});

// ─── § EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1 — curtina/ficha/media, APLICADO (no sólo la plomería) ──
//
// Las TRES comparten los MISMOS seis campos de texto libre (eyebrow/titulo/tituloEnfasis/subtitulo/
// los dos CTA, § EDICION-INLINE.md § 1.1) — se recorre con una tabla en vez de triplicar el cuerpo
// del test, para que agregar una variante futura a esta lista sea una fila, no una función nueva.

const CAMPOS_COMUNES: { campo: string; linea: 'unica' | 'multiple' }[] = [
  { campo: 'hero.eyebrow', linea: 'unica' },
  { campo: 'hero.titulo', linea: 'unica' },
  { campo: 'hero.tituloEnfasis', linea: 'unica' },
  { campo: 'hero.subtitulo', linea: 'multiple' },
  { campo: 'hero.ctaPrimarioLabel', linea: 'unica' },
  { campo: 'hero.ctaSecundarioLabel', linea: 'unica' },
];

const VARIANTES_SIN_TICKER: { nombre: string; Componente: typeof HeroCurtina }[] = [
  { nombre: 'HeroCurtina', Componente: HeroCurtina },
  { nombre: 'HeroFicha', Componente: HeroFicha },
  { nombre: 'HeroMedia', Componente: HeroMedia },
];

function renderVariante(Componente: typeof HeroCurtina, content: SiteContentData, opts: { activo?: boolean } = {}): string {
  let arbol: React.ReactElement = React.createElement(SiteContentProvider, { value: content, children: React.createElement(Componente) });
  if (opts.activo) arbol = React.createElement(ModoEditorProvider, { activo: true, children: arbol });
  return renderToStaticMarkup(arbol);
}

function contarMarcador(html: string, campo: string): number {
  const re = new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="${campo.replace(/[.]/g, '\\.')}"`, 'g');
  return (html.match(re) ?? []).length;
}

for (const { nombre, Componente } of VARIANTES_SIN_TICKER) {
  test(`${nombre}, SIN modo editor: cero \`data-editor-campo\` — byte-idéntico (el contrato que ya cumple data-editor-seccion)`, () => {
    const html = renderVariante(Componente, DEFAULTS as SiteContentData);
    assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
  });

  test(`${nombre}, CON modo editor: los seis campos comunes marcan su nodo, cada uno UNA sola vez, con la línea correcta`, () => {
    const html = renderVariante(Componente, DEFAULTS as SiteContentData, { activo: true });
    for (const { campo, linea } of CAMPOS_COMUNES) {
      assert.equal(contarMarcador(html, campo), 1, `${campo} debería marcar exactamente un nodo`);
      assert.match(
        html,
        new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="${campo.replace(/[.]/g, '\\.')}"[^>]*${ATRIBUTO_EDITOR_LINEA}="${linea}"`),
        `${campo} debería declarar data-editor-linea="${linea}"`,
      );
    }
  });
}

// `hero.fraseAlPie` es EXCLUSIVO de HeroMedia entre las tres sin ticker (curtina/ficha no lo leen,
// § EDICION-INLINE.md § 1.1 — "Sólo lo rinden las composiciones 'media' o 'sticky'"): se afirma
// aparte, no en la tabla común, para no sugerir que curtina/ficha también lo marcan.
test('HeroMedia, CON modo editor: `hero.fraseAlPie` (no común a curtina/ficha) marca su párrafo, multilinea', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, fraseAlPie: 'Tueste artesanal, lote por lote.' } } as SiteContentData;
  const html = renderVariante(HeroMedia, content, { activo: true });
  assert.equal(contarMarcador(html, 'hero.fraseAlPie'), 1);
  assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="hero\\.fraseAlPie"[^>]*${ATRIBUTO_EDITOR_LINEA}="multiple"`));
});

test('HeroCurtina/HeroFicha, CON modo editor: NO existe un marcador "hero.fraseAlPie" — ninguna de las dos lee ese campo', () => {
  for (const Componente of [HeroCurtina, HeroFicha]) {
    const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, fraseAlPie: 'Tueste artesanal, lote por lote.' } } as SiteContentData;
    const html = renderVariante(Componente, content, { activo: true });
    assert.equal(contarMarcador(html, 'hero.fraseAlPie'), 0);
  }
});

// ─── § EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1 — el campo IMAGEN/VIDEO, en las 4 variantes del hero ──
//
// Usa un marcador DISTINTO (`ATRIBUTO_EDITOR_CAMPO_IMAGEN`, no `ATRIBUTO_EDITOR_CAMPO`): un clic ahí
// nunca abre el overlay de texto. `HeroMediaMarquesina` (la variante "sticky") se afirma ACÁ y no en
// `lib/config/hero-marquesina.test.ts` —que ya tiene su propia infraestructura de render para esa
// composición, § EDICION-INLINE.md § 9— porque ese archivo NO está en `touches:` de este slice; el
// único sitio permitido para afirmar su marcador de imagen es éste.

function contarMarcadorImagen(html: string, campo: string): number {
  const re = new RegExp(`${ATRIBUTO_EDITOR_CAMPO_IMAGEN}="${campo.replace(/[.]/g, '\\.')}"`, 'g');
  return (html.match(re) ?? []).length;
}

function renderMarquesinaSticky(content: SiteContentData, opts: { activo?: boolean } = {}): string {
  let arbol: React.ReactElement = React.createElement(SiteContentProvider, { value: content, children: React.createElement(HeroMediaMarquesina) });
  if (opts.activo) arbol = React.createElement(ModoEditorProvider, { activo: true, children: arbol });
  return renderToStaticMarkup(arbol);
}

const VARIANTES_HERO_TODAS: { nombre: string; render: (c: SiteContentData, activo: boolean) => string }[] = [
  ...VARIANTES_SIN_TICKER.map(({ nombre, Componente }) => ({
    nombre,
    render: (c: SiteContentData, activo: boolean) => renderVariante(Componente, c, { activo }),
  })),
  { nombre: 'HeroMediaMarquesina', render: (c: SiteContentData, activo: boolean) => renderMarquesinaSticky(c, { activo }) },
];

for (const { nombre, render } of VARIANTES_HERO_TODAS) {
  test(`${nombre}, SIN modo editor: cero \`data-editor-campo-imagen\` — byte-idéntico`, () => {
    const html = render(DEFAULTS as SiteContentData, false);
    assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO_IMAGEN));
  });

  test(`${nombre}, CON modo editor, modo IMAGEN (default): marca \`hero.imagen\` una sola vez`, () => {
    const html = render(DEFAULTS as SiteContentData, true);
    assert.equal(contarMarcadorImagen(html, 'hero.imagen'), 1);
  });

  test(`${nombre}, CON modo editor, modo VIDEO (sin video de teléfono): marca \`hero.imagen\` una sola vez, sin \`hero.imagenPoster\` suelto`, () => {
    const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, imagenTipo: 'video', imagenPoster: '/images/poster.jpg' } } as unknown as SiteContentData;
    const html = render(content, true);
    assert.equal(contarMarcadorImagen(html, 'hero.imagen'), 1);
    assert.equal(contarMarcadorImagen(html, 'hero.imagenPoster'), 0);
  });
}

// SÓLO HeroMedia/HeroMediaMarquesina leen `imagenMovil` (§ EDICION-INLINE.md § 1.1: HeroCurtina/
// HeroFicha no tienen rama de video de teléfono). CON él presente, el `<picture>` del póster y el
// `<video>` son `absolute inset-0` en la MISMA caja — MEDIDO por ejecución (Playwright): el
// navegador siempre entrega el hit-test al `<video>` (pinta encima), nunca al `<picture>`, así que
// marcarlos como DOS nodos clickeables dejaba al póster como un selector FANTASMA (existe en el DOM,
// inalcanzable por el puntero). El fix es UN SOLO marcador (`hero.imagen`) para el PAR — `hero.
// imagenPoster` NO debe tener marcador propio en este estado.
const VARIANTES_CON_VIDEO_MOVIL: { nombre: string; render: (c: SiteContentData, activo: boolean) => string }[] = [
  { nombre: 'HeroMedia', render: (c: SiteContentData, activo: boolean) => renderVariante(HeroMedia, c, { activo }) },
  { nombre: 'HeroMediaMarquesina', render: (c: SiteContentData, activo: boolean) => renderMarquesinaSticky(c, { activo }) },
];

for (const { nombre, render } of VARIANTES_CON_VIDEO_MOVIL) {
  test(`${nombre}, CON modo editor, modo VIDEO + video de teléfono: UN SOLO marcador \`hero.imagen\` cubre el PAR picture+video`, () => {
    const content = {
      ...DEFAULTS,
      hero: {
        ...DEFAULTS.hero,
        imagenTipo: 'video',
        imagenPoster: '/images/poster.jpg',
        imagenMovil: '/images/video-movil.mp4',
        imagenMovilPoster: '/images/poster-movil.jpg',
      },
    } as unknown as SiteContentData;
    const html = render(content, true);
    assert.equal(contarMarcadorImagen(html, 'hero.imagen'), 1);
    // `hero.imagenPoster` NO lleva marcador propio acá — sería un selector fantasma (§ arriba).
    assert.equal(contarMarcadorImagen(html, 'hero.imagenPoster'), 0);
  });
}

// ─── § EDITOR-TIENDA-CAMPO-EDITABLE-HOME-1 — el resto de la home ──────────────────────────────────
//
// Mismo patrón que arriba (render con/sin `ModoEditorProvider`, contar `data-editor-campo`), por
// sección. `Spotlight.tsx` queda FUERA del render (§ el comentario de `fuenteSpotlight`, abajo): el
// componente SIEMPRE rinde `null` bajo `renderToStaticMarkup` (el catálogo llega por un `useEffect`
// que nunca corre en este carril, mismo límite ya documentado en `spotlight-banda.test.ts`/
// `titulares-saltos.test.ts`), así que su cobertura es por FUENTE, igual que esos dos archivos.

function renderConProvider(nodo: React.ReactElement, content: SiteContentData, opts: { activo?: boolean; cart?: boolean } = {}): string {
  let arbol: React.ReactElement = React.createElement(SiteContentProvider, { value: content, children: nodo });
  if (opts.cart) arbol = React.createElement(CartProvider, { children: arbol });
  if (opts.activo) arbol = React.createElement(ModoEditorProvider, { activo: true, children: arbol });
  return renderToStaticMarkup(arbol);
}

// ─── BrandStory — columnas (canónica) y centrada ───────────────────────────────────────────────────

test('BrandStoryColumnas, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(BrandStoryColumnas), DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

test('BrandStoryColumnas, CON modo editor: eyebrow/titulo/parrafo1/parrafo2 marcan su nodo (parrafo* multilinea) — SIN ctaLabel (la canónica no tiene CTA propio)', () => {
  const html = renderConProvider(React.createElement(BrandStoryColumnas), DEFAULTS as SiteContentData, { activo: true });
  for (const campo of ['brandStory.eyebrow', 'brandStory.titulo', 'brandStory.parrafo1', 'brandStory.parrafo2']) {
    assert.equal(contarMarcador(html, campo), 1, `${campo} debería marcar exactamente un nodo`);
  }
  assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="brandStory\\.parrafo1"[^>]*${ATRIBUTO_EDITOR_LINEA}="multiple"`));
  assert.equal(contarMarcador(html, 'brandStory.ctaLabel'), 0, 'columnas no rinde ningún CTA propio — no hay nodo que marcar');
});

test('BrandStoryCentrada, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(BrandStoryCentrada), DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

test('BrandStoryCentrada, CON modo editor: eyebrow/titulo/parrafo1 marcan su nodo (DEFAULTS, sin CTA cargado)', () => {
  const html = renderConProvider(React.createElement(BrandStoryCentrada), DEFAULTS as SiteContentData, { activo: true });
  for (const campo of ['brandStory.eyebrow', 'brandStory.titulo', 'brandStory.parrafo1']) {
    assert.equal(contarMarcador(html, campo), 1, `${campo} debería marcar exactamente un nodo`);
  }
  assert.equal(contarMarcador(html, 'brandStory.ctaLabel'), 0, 'sin ctaLabel/ctaDestino cargados (DEFAULTS), el CTA no rinde — no hay nodo que marcar');
});

test('BrandStoryCentrada, CON modo editor y CTA cargado: `brandStory.ctaLabel` marca su nodo', () => {
  const content = { ...DEFAULTS, brandStory: { ...DEFAULTS.brandStory, ctaLabel: 'Conócenos', ctaDestino: '/nosotros' } } as SiteContentData;
  const html = renderConProvider(React.createElement(BrandStoryCentrada), content, { activo: true });
  assert.equal(contarMarcador(html, 'brandStory.ctaLabel'), 1);
});

// ─── Origen — eyebrow/titulo/lede (TextoEnCascada con `campo`), los 4 datos y los 3 contadores ─────

const ORIGEN_COMPLETO = {
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

test('Origen, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(Origen), ORIGEN_COMPLETO);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

test('Origen, CON modo editor: eyebrow/titulo/lede (TextoEnCascada) marcan su nodo — `lede` multilinea', () => {
  const html = renderConProvider(React.createElement(Origen), ORIGEN_COMPLETO, { activo: true });
  assert.equal(contarMarcador(html, 'origen.eyebrow'), 1);
  assert.equal(contarMarcador(html, 'origen.titulo'), 1);
  assert.equal(contarMarcador(html, 'origen.lede'), 1);
  assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="origen\\.lede"[^>]*${ATRIBUTO_EDITOR_LINEA}="multiple"`));
});

test('Origen, CON modo editor: los 4 pares dato*Label/dato*Valor marcan su nodo — sólo los que tienen VALOR (dato3/4 vacíos no rinden)', () => {
  const html = renderConProvider(React.createElement(Origen), ORIGEN_COMPLETO, { activo: true });
  assert.equal(contarMarcador(html, 'origen.dato1Label'), 1);
  assert.equal(contarMarcador(html, 'origen.dato1Valor'), 1);
  assert.equal(contarMarcador(html, 'origen.dato2Label'), 1);
  assert.equal(contarMarcador(html, 'origen.dato2Valor'), 1);
  assert.equal(contarMarcador(html, 'origen.dato3Label'), 0, 'dato3 sin valor no rinde — ni su label');
});

test('Origen, CON modo editor: los 3 contadores marcan `statNumeroN`/`statEtiquetaN` por su SLOT real, no por el índice entre los visibles', () => {
  const html = renderConProvider(React.createElement(Origen), ORIGEN_COMPLETO, { activo: true });
  for (const n of [1, 2, 3]) {
    assert.equal(contarMarcador(html, `origen.statNumero${n}`), 1, `statNumero${n} debería marcar exactamente un nodo`);
    assert.equal(contarMarcador(html, `origen.statEtiqueta${n}`), 1, `statEtiqueta${n} debería marcar exactamente un nodo`);
  }
});

test('Origen, CON modo editor y stat2 VACÍO: stat3 sigue marcando `statNumero3` (su slot real), no `statNumero2` (el índice entre visibles)', () => {
  const content = {
    ...DEFAULTS,
    origen: {
      ...DEFAULTS.origen,
      visible: true,
      statNumero1: '1600', statEtiqueta1: 'msnm promedio',
      statNumero2: '', statEtiqueta2: '',
      statNumero3: '52', statEtiqueta3: 'años de tradición',
    },
  } as SiteContentData;
  const html = renderConProvider(React.createElement(Origen), content, { activo: true });
  assert.equal(contarMarcador(html, 'origen.statNumero1'), 1);
  assert.equal(contarMarcador(html, 'origen.statNumero2'), 0, 'stat2 vacío no rinde — no hay nodo que marque "statNumero2"');
  assert.equal(contarMarcador(html, 'origen.statNumero3'), 1, 'stat3, SEGUNDO visible, sigue marcando su slot real (3), no el índice (1→"statNumero2")');
});

test('Origen, CON modo editor: el contador muestra el VALOR CRUDO ("1600"), nunca el formateado ("1.600") — así el overlay no escribe de vuelta un string que Number() leería mal', () => {
  const html = renderConProvider(React.createElement(Origen), ORIGEN_COMPLETO, { activo: true });
  assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="origen\\.statNumero1"[^>]*>1600<`), 'el nodo de statNumero1 debe mostrar "1600" crudo');
  assert.ok(!html.includes('1.600'), 'el separador de miles NO debe aparecer en modo editor — sería lo que el overlay leería como valor inicial');
});

test('Origen, SIN modo editor (SSR, sin preview): el contador sigue arrancando en "0" — el cambio de § EDITOR-TIENDA-CAMPO-EDITABLE-HOME-1 no toca el comportamiento público', () => {
  const html = renderConProvider(React.createElement(Origen), ORIGEN_COMPLETO);
  const ceros = html.match(/>0</g) ?? [];
  assert.equal(ceros.length, 3, 'las TRES estadísticas deben seguir arrancando en 0 sin scroll/observer real — comportamiento previo intacto');
});

// ─── Presentaciones — Mosaico/Índice: encabezado + tarjetas por SLOT (no por posición visible) ─────

const PRESENTACIONES_4_FUERA_DE_ORDEN = {
  ...DEFAULTS,
  presentaciones: {
    ...DEFAULTS.presentaciones,
    // slot 3 vacío, slot 4 lleno — la tarjeta visible #3 (posición 2, 0-based) debe marcar "label4",
    // no "label3" (§ TarjetaPresentacion.slot, lib/storefront/presentaciones.ts).
    label3: '', copy3: '', imagen3: '',
    label4: 'Presentación Extra', copy4: 'La cuarta, fuera de orden.', imagen4: '',
  },
} as SiteContentData;

for (const { nombre, Componente } of [
  { nombre: 'GrindChooserMosaico', Componente: GrindChooserMosaico },
  { nombre: 'GrindChooserIndice', Componente: GrindChooserIndice },
]) {
  test(`${nombre}, SIN modo editor: cero \`data-editor-campo\` — byte-idéntico`, () => {
    const html = renderConProvider(React.createElement(Componente), DEFAULTS as SiteContentData);
    assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
  });

  test(`${nombre}, CON modo editor: eyebrow/titulo del encabezado marcan su nodo`, () => {
    const html = renderConProvider(React.createElement(Componente), DEFAULTS as SiteContentData, { activo: true });
    assert.equal(contarMarcador(html, 'presentaciones.eyebrow'), 1);
    assert.equal(contarMarcador(html, 'presentaciones.titulo'), 1);
  });

  test(`${nombre}, CON modo editor: las tarjetas 1 y 2 (DEFAULTS) marcan label1/copy1 y label2/copy2`, () => {
    const html = renderConProvider(React.createElement(Componente), DEFAULTS as SiteContentData, { activo: true });
    for (const n of [1, 2]) {
      assert.equal(contarMarcador(html, `presentaciones.label${n}`), 1, `label${n} debería marcar un nodo`);
      assert.equal(contarMarcador(html, `presentaciones.copy${n}`), 1, `copy${n} debería marcar un nodo`);
    }
  });

  test(`${nombre}, CON modo editor, slot 3 vacío y slot 4 lleno: la tarjeta visible marca "label4"/"copy4" — el SLOT real, no la posición entre las visibles`, () => {
    const html = renderConProvider(React.createElement(Componente), PRESENTACIONES_4_FUERA_DE_ORDEN, { activo: true });
    assert.equal(contarMarcador(html, 'presentaciones.label3'), 0, 'slot 3 vacío no rinde tarjeta — no hay nodo que marque "label3"');
    assert.equal(contarMarcador(html, 'presentaciones.label4'), 1, 'la tarjeta visible (la 3ª en pantalla) es el slot 4 — debe marcar "label4"');
    assert.equal(contarMarcador(html, 'presentaciones.copy4'), 1);
  });
}

// ─── Presentaciones — Riel: SÓLO el encabezado (las tarjetas visibles son del CATÁLOGO, § doc) ─────

function renderRielConProvider(content: SiteContentData, activo: boolean): string {
  return renderConProvider(React.createElement(GrindChooserRiel), content, { activo, cart: true });
}

test('GrindChooserRiel, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const html = renderRielConProvider(DEFAULTS as SiteContentData, false);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

test('GrindChooserRiel, CON modo editor: eyebrow/titulo del encabezado marcan su nodo', () => {
  const html = renderRielConProvider(DEFAULTS as SiteContentData, true);
  assert.equal(contarMarcador(html, 'presentaciones.eyebrow'), 1);
  assert.equal(contarMarcador(html, 'presentaciones.titulo'), 1);
  // Bajo 'riel' las tarjetas SALEN DEL CATÁLOGO (§ doc, tarjetasDePresentaciones no aplica) — sin
  // catálogo cargado en este carril (useEffect nunca corre), no hay "label1"/"copy1" que marcar;
  // confirmar su AUSENCIA sería afirmar un negativo sobre un dato que esta variante ni lee.
});

test('GrindChooserRiel, CON modo editor y CTA cargado (ctaLabel + ctaDestino válido): `presentaciones.ctaLabel` marca su nodo', () => {
  const content = { ...DEFAULTS, presentaciones: { ...DEFAULTS.presentaciones, ctaLabel: 'Ver todo', ctaDestino: '/tienda' } } as SiteContentData;
  const html = renderRielConProvider(content, true);
  assert.equal(contarMarcador(html, 'presentaciones.ctaLabel'), 1);
});

test('GrindChooserRiel, CON modo editor: el <h2> del titular SIGUE llevando `whitespace-pre-line` — el marcador no reemplaza la clase (§ CORTE-TITULARES-SALTOS-DE-LINEA-1, no se toca)', () => {
  const html = renderRielConProvider(DEFAULTS as SiteContentData, true);
  assert.match(html, /<h2[^>]*class="[^"]*\bwhitespace-pre-line\b[^"]*"[^>]*>/);
});

// ─── Spotlight — por FUENTE, nunca por render (§ el comentario de cabecera, arriba) ────────────────

function fuenteSpotlight(): string {
  const srcPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../components/storefront/home/Spotlight.tsx');
  return readFileSync(srcPath, 'utf8');
}

test('Spotlight.tsx: eyebrow/badge/nombreCafe/notaPrecio están envueltos en su `<CampoEditable campo="spotlight.…">`', () => {
  const src = fuenteSpotlight();
  for (const campo of ['spotlight.eyebrow', 'spotlight.badge', 'spotlight.nombreCafe', 'spotlight.notaPrecio']) {
    assert.match(src, new RegExp(`<CampoEditable campo="${campo.replace('.', '\\.')}"`), `falta <CampoEditable campo="${campo}"> en la fuente`);
  }
});

test('Spotlight.tsx: el <h2> que rinde spotlight.titulo SIGUE llevando whitespace-pre-line Y AHORA envuelve el texto en CampoEditable, en la MISMA línea (§ CORTE-TITULARES-SALTOS-DE-LINEA-1, titulares-saltos.test.ts no se toca)', () => {
  const src = fuenteSpotlight();
  const linea = src.split('\n').find((l) => l.includes('{spotlight.titulo}'));
  assert.ok(linea, 'no se encontró la línea del <h2> que rinde spotlight.titulo');
  assert.match(linea!, /<h2\b/);
  assert.match(linea!, /className="[^"]*\bwhitespace-pre-line\b[^"]*"/);
  assert.match(linea!, /<CampoEditable campo="spotlight\.titulo"/);
});

test('Spotlight.tsx: `CampoEditable` está importado', () => {
  const src = fuenteSpotlight();
  assert.match(src, /import CampoEditable from "@\/components\/storefront\/CampoEditable";/);
});

// ─── SubscriptionCTA — bloque (eyebrow/titulo/subtitulo/bullets/ctaLabel) y línea (franja) ─────────

test('SubscriptionCTABloque, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(SubscriptionCTABloque), DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

test('SubscriptionCTABloque, CON modo editor: eyebrow/titulo/subtitulo/ctaLabel marcan su nodo — subtitulo multilinea', () => {
  const html = renderConProvider(React.createElement(SubscriptionCTABloque), DEFAULTS as SiteContentData, { activo: true });
  for (const campo of ['subscriptionCTA.eyebrow', 'subscriptionCTA.titulo', 'subscriptionCTA.subtitulo', 'subscriptionCTA.ctaLabel']) {
    assert.equal(contarMarcador(html, campo), 1, `${campo} debería marcar exactamente un nodo`);
  }
  assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="subscriptionCTA\\.subtitulo"[^>]*${ATRIBUTO_EDITOR_LINEA}="multiple"`));
});

test('SubscriptionCTABloque, CON modo editor: los 4 bullets (DEFAULTS) marcan bullet1..4 por su SLOT real', () => {
  const html = renderConProvider(React.createElement(SubscriptionCTABloque), DEFAULTS as SiteContentData, { activo: true });
  for (const n of [1, 2, 3, 4]) {
    assert.equal(contarMarcador(html, `subscriptionCTA.bullet${n}`), 1, `bullet${n} debería marcar un nodo`);
  }
});

test('SubscriptionCTABloque, CON modo editor y bullet2 VACÍO: el segundo bullet VISIBLE sigue marcando "bullet3" (su slot real), no "bullet2"', () => {
  const content = { ...DEFAULTS, subscriptionCTA: { ...DEFAULTS.subscriptionCTA, bullet2: '' } } as SiteContentData;
  const html = renderConProvider(React.createElement(SubscriptionCTABloque), content, { activo: true });
  assert.equal(contarMarcador(html, 'subscriptionCTA.bullet1'), 1);
  assert.equal(contarMarcador(html, 'subscriptionCTA.bullet2'), 0, 'bullet2 vacío no rinde — no hay nodo que marque "bullet2"');
  assert.equal(contarMarcador(html, 'subscriptionCTA.bullet3'), 1, 'bullet3, SEGUNDO visible, sigue marcando su slot real (3)');
});

test('SubscriptionCTALinea, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(SubscriptionCTALinea), DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

test('SubscriptionCTALinea, CON modo editor: eyebrow/titulo/ctaLabel marcan su nodo — SIN ctaSecundarioLabel (DEFAULTS no lo carga)', () => {
  const html = renderConProvider(React.createElement(SubscriptionCTALinea), DEFAULTS as SiteContentData, { activo: true });
  for (const campo of ['subscriptionCTA.eyebrow', 'subscriptionCTA.titulo', 'subscriptionCTA.ctaLabel']) {
    assert.equal(contarMarcador(html, campo), 1, `${campo} debería marcar exactamente un nodo`);
  }
  assert.equal(contarMarcador(html, 'subscriptionCTA.ctaSecundarioLabel'), 0);
});

test('SubscriptionCTALinea, CON modo editor y segundo CTA cargado: `ctaSecundarioLabel` marca su nodo', () => {
  const content = {
    ...DEFAULTS,
    subscriptionCTA: { ...DEFAULTS.subscriptionCTA, ctaSecundarioLabel: 'Explorar', ctaSecundarioDestino: '/tienda' },
  } as SiteContentData;
  const html = renderConProvider(React.createElement(SubscriptionCTALinea), content, { activo: true });
  assert.equal(contarMarcador(html, 'subscriptionCTA.ctaSecundarioLabel'), 1);
});

test('SubscriptionCTALinea, CON modo editor: el título SIGUE viviendo dentro de la máscara (`overflow-hidden leading-none`) — el marcador no cambia esa estructura (§ SUSCRIPCION-TITULO-Y-RECARGA-1, no se toca)', () => {
  const html = renderConProvider(React.createElement(SubscriptionCTALinea), DEFAULTS as SiteContentData, { activo: true });
  assert.match(html, /<div class="overflow-hidden leading-none">/);
});

// ─── Testimonios — encabezado + el repeater (name/text/city/product por ítem, stars excluido) ──────

const TESTIMONIO_FIXTURE = {
  ...DEFAULTS,
  testimonials: {
    ...DEFAULTS.testimonials,
    items: [
      { name: 'Valentina Torres', city: 'Bogotá', text: 'Excelente café, llega siempre a tiempo.', product: 'Café Nariño', stars: 5 },
      { name: 'Luis Cagua', city: '', text: 'Muy buena calidad.', product: '', stars: 4 },
    ],
  },
} as SiteContentData;

test('TestimonialSection, SIN modo editor: cero `data-editor-campo` — byte-idéntico, incluida la atribución combinada ciudad·producto', () => {
  const html = renderConProvider(React.createElement(TestimonialSection), TESTIMONIO_FIXTURE);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
  assert.ok(html.includes('Bogotá · Café Nariño'), 'la atribución combinada debe seguir viéndose IDÉNTICA, byte a byte, fuera de modo editor');
});

test('TestimonialSection, CON modo editor: eyebrow/titulo del encabezado marcan su nodo', () => {
  const html = renderConProvider(React.createElement(TestimonialSection), TESTIMONIO_FIXTURE, { activo: true });
  assert.equal(contarMarcador(html, 'testimonials.eyebrow'), 1);
  assert.equal(contarMarcador(html, 'testimonials.titulo'), 1);
});

test('TestimonialSection, CON modo editor: name/text de CADA ítem marcan su ruta `testimonials.items.N.campo` — `text` multilinea, `stars` SIN marcador (no es texto)', () => {
  const html = renderConProvider(React.createElement(TestimonialSection), TESTIMONIO_FIXTURE, { activo: true });
  for (let i = 0; i < 2; i++) {
    assert.equal(contarMarcador(html, `testimonials.items.${i}.name`), 1, `items.${i}.name debería marcar un nodo`);
    assert.equal(contarMarcador(html, `testimonials.items.${i}.text`), 1, `items.${i}.text debería marcar un nodo`);
    assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="testimonials\\.items\\.${i}\\.text"[^>]*${ATRIBUTO_EDITOR_LINEA}="multiple"`));
  }
  assert.doesNotMatch(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="testimonials\\.items\\.\\d\\.stars"`), 'stars es numérico (clic de estrellas) — nunca un campo de texto');
});

// ─── LAS IMÁGENES del resto de la home (§ EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1, el flujo) ─────────

test('Marquesina, CON modo editor: `marquesina.imagen` (fondo) marca su nodo con el atributo de IMAGEN, no el de texto', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderConProvider(React.createElement(Marquesina), content, { activo: true });
  assert.equal(contarMarcadorImagen(html, 'marquesina.imagen'), 1);
});

for (const { nombre, Componente } of [
  { nombre: 'BrandStoryColumnas', Componente: BrandStoryColumnas },
  { nombre: 'BrandStoryCentrada', Componente: BrandStoryCentrada },
]) {
  test(`${nombre}, CON modo editor: imagen1..4 (las 4 llenas, DEFAULTS) marcan su nodo con el atributo de IMAGEN`, () => {
    const html = renderConProvider(React.createElement(Componente), DEFAULTS as SiteContentData, { activo: true });
    for (const n of [1, 2, 3, 4]) {
      assert.equal(contarMarcadorImagen(html, `brandStory.imagen${n}`), 1, `imagen${n} debería marcar un nodo de imagen`);
    }
    assert.doesNotMatch(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="brandStory\\.imagen`), 'una imagen nunca lleva el atributo de TEXTO');
  });

  // § EDITOR-TIENDA-CAMPO-EDITABLE-CIERRE-1, cierra `CAMPO-EDITABLE-IMAGEN-SLOT-VACIO-OPCIONAL-1`:
  // imagen2/3/4 vacíos (opcionales) quedaban sin NINGÚN nodo donde clickear para agregar la primera
  // foto — el `.filter()` que compone el collage las omitía enteras. `imagen1` es requerida (el
  // resolver la rellena con el default) y por tanto nunca puede estar vacía en este fixture.
  test(`${nombre}, CON modo editor e imagen2/3/4 VACÍOS: cada uno marca el HUECO "Agregar foto" con el atributo de IMAGEN — imagen1 (requerida, con valor) sigue marcando el nodo real`, () => {
    const content = { ...DEFAULTS, brandStory: { ...DEFAULTS.brandStory, imagen2: '', imagen3: '', imagen4: '' } } as SiteContentData;
    const html = renderConProvider(React.createElement(Componente), content, { activo: true });
    assert.equal(contarMarcadorImagen(html, 'brandStory.imagen1'), 1);
    for (const n of [2, 3, 4]) {
      assert.equal(contarMarcadorImagen(html, `brandStory.imagen${n}`), 1, `imagen${n} debería marcar el hueco`);
    }
    assert.equal((html.match(/Agregar foto/g) || []).length, 3, 'un hueco por cada opcional vacía');
  });

  test(`${nombre}, SIN modo editor e imagen2/3/4 VACÍOS: SIN huecos — byte-idéntico (sólo imagen1 se rinde, como antes de este slice)`, () => {
    const content = { ...DEFAULTS, brandStory: { ...DEFAULTS.brandStory, imagen2: '', imagen3: '', imagen4: '' } } as SiteContentData;
    const html = renderConProvider(React.createElement(Componente), content);
    assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO_IMAGEN));
    assert.ok(!html.includes('Agregar foto'));
  });
}

test('Origen, CON modo editor: imagen1/imagen2 (requeridas) marcan su nodo con el atributo de IMAGEN', () => {
  const html = renderConProvider(React.createElement(Origen), ORIGEN_COMPLETO, { activo: true });
  assert.equal(contarMarcadorImagen(html, 'origen.imagen1'), 1);
  assert.equal(contarMarcadorImagen(html, 'origen.imagen2'), 1);
});

for (const { nombre, Componente } of [
  { nombre: 'GrindChooserMosaico', Componente: GrindChooserMosaico },
  { nombre: 'GrindChooserIndice', Componente: GrindChooserIndice },
]) {
  test(`${nombre}, CON modo editor, imagen1/2 VACÍAS (el estado real de Nayoli, DEFAULTS): el marcador de imagen SIGUE presente — la tarjeta 1-2 siempre se muestra, con o sin foto`, () => {
    const html = renderConProvider(React.createElement(Componente), DEFAULTS as SiteContentData, { activo: true });
    assert.equal(contarMarcadorImagen(html, 'presentaciones.imagen1'), 1, 'sin foto, debe seguir habiendo un nodo clickeable para AGREGAR la primera');
    assert.equal(contarMarcadorImagen(html, 'presentaciones.imagen2'), 1);
  });

  test(`${nombre}, CON modo editor, slot 4 con imagen cargada: marca "presentaciones.imagen4" por su SLOT real`, () => {
    const content = {
      ...DEFAULTS,
      presentaciones: { ...DEFAULTS.presentaciones, label4: 'Extra', imagen4: '/images/historia-1-v1.jpg' },
    } as SiteContentData;
    const html = renderConProvider(React.createElement(Componente), content, { activo: true });
    assert.equal(contarMarcadorImagen(html, 'presentaciones.imagen4'), 1);
  });
}

test('SubscriptionCTALinea, CON modo editor e imagenFondo cargada: `subscriptionCTA.imagenFondo` marca su nodo con el atributo de IMAGEN', () => {
  const content = { ...DEFAULTS, subscriptionCTA: { ...DEFAULTS.subscriptionCTA, imagenFondo: '/images/historia-1-v1.jpg' } } as SiteContentData;
  const html = renderConProvider(React.createElement(SubscriptionCTALinea), content, { activo: true });
  assert.equal(contarMarcadorImagen(html, 'subscriptionCTA.imagenFondo'), 1);
});

test('SubscriptionCTALinea, CON modo editor e imagenFondo cargada: el velo decorativo lleva `pointer-events-none` (§ EDITOR-TIENDA-CAMPO-EDITABLE-CIERRE-1, mismo defecto ya cerrado para NosotrosCierre/GrindChooserMosaico)', () => {
  const content = { ...DEFAULTS, subscriptionCTA: { ...DEFAULTS.subscriptionCTA, imagenFondo: '/images/historia-1-v1.jpg' } } as SiteContentData;
  const html = renderConProvider(React.createElement(SubscriptionCTALinea), content, { activo: true });
  assert.match(html, /bg-linear-to-b from-\[var\(--sf-tinta\)\]\/60 to-\[var\(--sf-velo\)\] pointer-events-none/);
});

test('SubscriptionCTALinea, CON modo editor e imagenFondo VACÍA (DEFAULTS): marca el HUECO "Agregar foto" (§ EDITOR-TIENDA-CAMPO-EDITABLE-CIERRE-1, cierra CAMPO-EDITABLE-IMAGEN-SLOT-VACIO-OPCIONAL-1)', () => {
  const html = renderConProvider(React.createElement(SubscriptionCTALinea), DEFAULTS as SiteContentData, { activo: true });
  assert.equal(contarMarcadorImagen(html, 'subscriptionCTA.imagenFondo'), 1);
  assert.ok(html.includes('Agregar foto'));
});

test('SubscriptionCTALinea, SIN modo editor e imagenFondo VACÍA (DEFAULTS): SIN hueco — byte-idéntico a antes de este slice', () => {
  const html = renderConProvider(React.createElement(SubscriptionCTALinea), DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO_IMAGEN));
  assert.ok(!html.includes('Agregar foto'));
});

test('SubscriptionCTABloque, CON modo editor: SIN marcador de imagen — la canónica NO lee `imagenFondo` (§ cta-banner-foto.test.ts, fuera de touches, no se toca)', () => {
  const html = renderConProvider(React.createElement(SubscriptionCTABloque), DEFAULTS as SiteContentData, { activo: true });
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO_IMAGEN));
});

test('TestimonialSection, CON modo editor: city/product marcan CADA UNO su propio nodo, en el MISMO orden y con el " · " literal entre los dos (ambos con valor)', () => {
  const html = renderConProvider(React.createElement(TestimonialSection), TESTIMONIO_FIXTURE, { activo: true });
  // Ítem 0: city="Bogotá" Y product="Café Nariño" — los DOS marcan, con el separador entre ambos.
  assert.equal(contarMarcador(html, 'testimonials.items.0.city'), 1);
  assert.equal(contarMarcador(html, 'testimonials.items.0.product'), 1);
  const idxCity = html.indexOf('Bogotá');
  const idxSep = html.indexOf(' · ', idxCity);
  const idxProduct = html.indexOf('Café Nariño', idxSep);
  assert.ok(idxCity > -1 && idxSep > idxCity && idxProduct > idxSep, 'el orden en el HTML debe ser city → " · " → product');
  // Ítem 1: city="" y product="" — ninguno de los dos marca (hide-on-empty, ni siquiera el separador).
  assert.equal(contarMarcador(html, 'testimonials.items.1.city'), 0);
  assert.equal(contarMarcador(html, 'testimonials.items.1.product'), 0);
});

// ─── § EDITOR-TIENDA-CAMPO-EDITABLE-PAGINAS-1 — /nosotros y /suscripciones ────────────────────────
//
// Mismo patrón que § EDITOR-TIENDA-CAMPO-EDITABLE-HOME-1 (render con/sin `ModoEditorProvider`,
// `renderConProvider`/`contarMarcador`/`contarMarcadorImagen` ya definidos arriba). El PRECIO de los
// planes queda EXPLÍCITAMENTE sin marcador (§ el spec de este slice, aprobación del owner) — se
// afirma la AUSENCIA, no sólo se omite la aserción.

// ─── NosotrosHistoria ──────────────────────────────────────────────────────────────────────────────

test('NosotrosHistoria, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(NosotrosHistoria), DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO_IMAGEN));
});

test('NosotrosHistoria, CON modo editor (DEFAULTS): eyebrow/titulo/parrafo1/parrafo2 marcan su nodo (parrafo* multilinea) — parrafo3 vacío no marca (sin nodo que envolver)', () => {
  const html = renderConProvider(React.createElement(NosotrosHistoria), DEFAULTS as SiteContentData, { activo: true });
  for (const campo of ['nosotrosHistoria.eyebrow', 'nosotrosHistoria.titulo', 'nosotrosHistoria.parrafo1', 'nosotrosHistoria.parrafo2']) {
    assert.equal(contarMarcador(html, campo), 1, `${campo} debería marcar un nodo`);
  }
  assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="nosotrosHistoria\\.parrafo1"[^>]*${ATRIBUTO_EDITOR_LINEA}="multiple"`));
  assert.equal(contarMarcador(html, 'nosotrosHistoria.parrafo3'), 0);
});

test('NosotrosHistoria, CON modo editor y parrafo2 VACÍO/parrafo3 cargado: el segundo párrafo VISIBLE sigue marcando "parrafo3" (su slot real), no "parrafo2"', () => {
  const content = { ...DEFAULTS, nosotrosHistoria: { ...DEFAULTS.nosotrosHistoria, parrafo2: '', parrafo3: 'Seguimos creciendo cada año.' } } as SiteContentData;
  const html = renderConProvider(React.createElement(NosotrosHistoria), content, { activo: true });
  assert.equal(contarMarcador(html, 'nosotrosHistoria.parrafo2'), 0);
  assert.equal(contarMarcador(html, 'nosotrosHistoria.parrafo3'), 1);
});

test('NosotrosHistoria, CON modo editor, imagen VACÍA (DEFAULTS): marca el HUECO "Agregar foto" (§ EDITOR-TIENDA-CAMPO-EDITABLE-CIERRE-1, cierra CAMPO-EDITABLE-IMAGEN-SLOT-VACIO-OPCIONAL-1) — la rama de DOS columnas ahora existe también sin imagen, en modo editor', () => {
  const html = renderConProvider(React.createElement(NosotrosHistoria), DEFAULTS as SiteContentData, { activo: true });
  assert.equal(contarMarcadorImagen(html, 'nosotrosHistoria.imagen'), 1);
  assert.ok(html.includes('Agregar foto'));
});

test('NosotrosHistoria, SIN modo editor, imagen VACÍA (DEFAULTS): SIN hueco — cero `data-editor-campo-imagen`, byte-idéntico a antes de este slice', () => {
  const html = renderConProvider(React.createElement(NosotrosHistoria), DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO_IMAGEN));
  assert.ok(!html.includes('Agregar foto'));
});

test('NosotrosHistoria, CON modo editor e imagen cargada: `nosotrosHistoria.imagen` marca su nodo con el atributo de IMAGEN', () => {
  const content = { ...DEFAULTS, nosotrosHistoria: { ...DEFAULTS.nosotrosHistoria, imagen: '/images/historia-1-v1.jpg' } } as SiteContentData;
  const html = renderConProvider(React.createElement(NosotrosHistoria), content, { activo: true });
  assert.equal(contarMarcadorImagen(html, 'nosotrosHistoria.imagen'), 1);
});

// ─── NosotrosGaleria ───────────────────────────────────────────────────────────────────────────────
//
// `items: []` (DEFAULTS) hace que el componente entero rinda `null` (hide-on-empty) — todos los
// fixtures de este bloque traen ítems propios.

const NOSOTROS_GALERIA_FIXTURE = {
  ...DEFAULTS,
  nosotrosGaleria: {
    ...DEFAULTS.nosotrosGaleria,
    items: [
      { url: '', alt: '' }, // índice 0 — SIN url, no se renderiza ningún nodo
      { url: '/images/galeria-1.jpg', alt: 'La finca' }, // índice 1
      { url: '', alt: '' }, // índice 2 — SIN url, hueco en medio
      { url: '/images/galeria-2.mp4', alt: 'El proceso', tipo: 'video' as const, poster: '/images/galeria-2-poster.jpg' }, // índice 3
    ],
  },
} as SiteContentData;

test('NosotrosGaleria, SIN modo editor: cero `data-editor-campo`/`data-editor-campo-imagen` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(NosotrosGaleria), NOSOTROS_GALERIA_FIXTURE);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO_IMAGEN));
  assert.doesNotMatch(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}=`));
});

test('NosotrosGaleria, CON modo editor: eyebrow/titulo marcan su nodo', () => {
  const html = renderConProvider(React.createElement(NosotrosGaleria), NOSOTROS_GALERIA_FIXTURE, { activo: true });
  assert.equal(contarMarcador(html, 'nosotrosGaleria.eyebrow'), 1);
  assert.equal(contarMarcador(html, 'nosotrosGaleria.titulo'), 1);
});

test('NosotrosGaleria, CON modo editor: cada ítem con `url` marca `items.IDX.url` por su ÍNDICE ORIGINAL en `items`, no por su posición entre los medios filtrados — un marcador, imagen Y video', () => {
  const html = renderConProvider(React.createElement(NosotrosGaleria), NOSOTROS_GALERIA_FIXTURE, { activo: true });
  // Índices 0 y 2 (url vacía): sin url no hay NINGÚN nodo que envolver.
  assert.equal(contarMarcadorImagen(html, 'nosotrosGaleria.items.0.url'), 0);
  assert.equal(contarMarcadorImagen(html, 'nosotrosGaleria.items.2.url'), 0);
  // Índice 1 (imagen) e índice 3 (video): el MISMO marcador de imagen cubre los dos tipos.
  assert.equal(contarMarcadorImagen(html, 'nosotrosGaleria.items.1.url'), 1);
  assert.equal(contarMarcadorImagen(html, 'nosotrosGaleria.items.3.url'), 1);
  // Nunca el atributo de TEXTO sobre un ítem de la galería.
  assert.doesNotMatch(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="nosotrosGaleria\\.items`));
});

test('NosotrosGaleria, CON modo editor: `alt`/`poster`/`tipo` de un ítem NO llevan marcador propio — ninguno es un nodo de TEXTO visible (atributos, o un selector)', () => {
  const html = renderConProvider(React.createElement(NosotrosGaleria), NOSOTROS_GALERIA_FIXTURE, { activo: true });
  assert.doesNotMatch(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO_IMAGEN}="nosotrosGaleria\\.items\\.\\d\\.(alt|poster|tipo)"`));
  assert.doesNotMatch(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="nosotrosGaleria\\.items\\.\\d\\.(alt|poster|tipo)"`));
});

// ─── NosotrosCierre ────────────────────────────────────────────────────────────────────────────────
//
// `titulo: ''` (DEFAULTS) hace que el componente entero rinda `null` (hide-on-empty por título) —
// todos los fixtures de este bloque traen `titulo` cargado.

const NOSOTROS_CIERRE_FIXTURE = {
  ...DEFAULTS,
  nosotrosCierre: {
    ...DEFAULTS.nosotrosCierre,
    titulo: 'Ven a conocer la finca',
    parrafo: 'Te esperamos con un café.',
    ctaLabel: 'Visítanos',
    ctaDestino: '/tienda',
    imagenFondo: '/images/historia-1-v1.jpg',
  },
} as SiteContentData;

test('NosotrosCierre, SIN modo editor: cero `data-editor-campo`/`data-editor-campo-imagen` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(NosotrosCierre), NOSOTROS_CIERRE_FIXTURE);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO_IMAGEN));
  assert.doesNotMatch(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}=`));
});

test('NosotrosCierre, CON modo editor: titulo/parrafo/ctaLabel marcan su nodo de TEXTO, imagenFondo marca su nodo de IMAGEN', () => {
  const html = renderConProvider(React.createElement(NosotrosCierre), NOSOTROS_CIERRE_FIXTURE, { activo: true });
  assert.equal(contarMarcador(html, 'nosotrosCierre.titulo'), 1);
  assert.equal(contarMarcador(html, 'nosotrosCierre.parrafo'), 1);
  assert.equal(contarMarcador(html, 'nosotrosCierre.ctaLabel'), 1);
  assert.equal(contarMarcadorImagen(html, 'nosotrosCierre.imagenFondo'), 1);
});

test('NosotrosCierre, CON modo editor y SÓLO titulo cargado (parrafo/cta/imagenFondo vacíos): titulo marca su nodo de texto, imagenFondo marca el HUECO "Agregar foto" (§ EDITOR-TIENDA-CAMPO-EDITABLE-CIERRE-1) — parrafo/ctaLabel SIGUEN sin nodo, y el componente no revienta', () => {
  const content = { ...DEFAULTS, nosotrosCierre: { ...DEFAULTS.nosotrosCierre, titulo: 'Ven a conocer la finca' } } as SiteContentData;
  const html = renderConProvider(React.createElement(NosotrosCierre), content, { activo: true });
  assert.equal(contarMarcador(html, 'nosotrosCierre.titulo'), 1);
  assert.equal(contarMarcador(html, 'nosotrosCierre.parrafo'), 0);
  assert.equal(contarMarcador(html, 'nosotrosCierre.ctaLabel'), 0);
  assert.equal(contarMarcadorImagen(html, 'nosotrosCierre.imagenFondo'), 1, 'el hueco "Agregar foto" ocupa el lugar del fondo vacío');
});

test('NosotrosCierre, SIN modo editor y SÓLO titulo cargado (imagenFondo vacío): SIN hueco — cero `data-editor-campo-imagen`, byte-idéntico a antes de este slice', () => {
  const content = { ...DEFAULTS, nosotrosCierre: { ...DEFAULTS.nosotrosCierre, titulo: 'Ven a conocer la finca' } } as SiteContentData;
  const html = renderConProvider(React.createElement(NosotrosCierre), content);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO_IMAGEN));
  assert.ok(!html.includes('Agregar foto'));
});

test('NosotrosCierre, CON modo editor e imagenFondo cargada: el velo decorativo NO tiene marcador, y lleva `pointer-events-none` (§ DEVIACIÓN MEDIDA, mismo defecto ya cerrado para GrindChooserMosaico)', () => {
  const html = renderConProvider(React.createElement(NosotrosCierre), NOSOTROS_CIERRE_FIXTURE, { activo: true });
  // El velo es el `<div>` con el gradiente `--sf-velo`; confirmamos que la clase trae `pointer-events-none`
  // en la MISMA etiqueta que el gradiente, para que el marcador de imagen que está debajo sea alcanzable.
  assert.match(html, /bg-linear-to-b from-\[var\(--sf-tinta\)\]\/60 to-\[var\(--sf-velo\)\] pointer-events-none/);
});

// ─── SuscripcionPlanes — ENCABEZADO + PLANES ──────────────────────────────────────────────────────
//
// DEFAULTS trae 3 planes visibles (nombre1..3; nombre4 vacío → plan 4 oculto) con 3 beneficios cada
// uno (benN_4 vacío, un hueco al FINAL — no prueba la preservación de slot). El `whatsapp` prop se
// pasa para que el CTA de WhatsApp se renderice (§ `(whatsapp || preview) && …`).

test('SuscripcionPlanes, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(SuscripcionPlanes, { whatsapp: '+573000000000' }), DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

test('SuscripcionPlanes, CON modo editor (DEFAULTS): el encabezado (eyebrow/titulo/tituloEnfasis/subtitulo/planesTitulo/planesSubtitulo) marca su nodo — subtitulo/planesSubtitulo multilinea', () => {
  const html = renderConProvider(React.createElement(SuscripcionPlanes, { whatsapp: '+573000000000' }), DEFAULTS as SiteContentData, { activo: true });
  for (const campo of ['suscripcionPlanes.eyebrow', 'suscripcionPlanes.titulo', 'suscripcionPlanes.tituloEnfasis', 'suscripcionPlanes.subtitulo', 'suscripcionPlanes.planesTitulo', 'suscripcionPlanes.planesSubtitulo']) {
    assert.equal(contarMarcador(html, campo), 1, `${campo} debería marcar un nodo`);
  }
  assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="suscripcionPlanes\\.subtitulo"[^>]*${ATRIBUTO_EDITOR_LINEA}="multiple"`));
});

test('SuscripcionPlanes, CON modo editor (DEFAULTS): los TRES planes visibles (1..3) marcan `nombreN`/`descripcionN` por su SLOT — plan 4 (sin nombre) no marca nada, y `ctaLabel` marca UNA vez por tarjeta visible', () => {
  const html = renderConProvider(React.createElement(SuscripcionPlanes, { whatsapp: '+573000000000' }), DEFAULTS as SiteContentData, { activo: true });
  for (const n of [1, 2, 3]) {
    assert.equal(contarMarcador(html, `suscripcionPlanes.nombre${n}`), 1, `nombre${n} debería marcar un nodo`);
    assert.equal(contarMarcador(html, `suscripcionPlanes.descripcion${n}`), 1, `descripcion${n} debería marcar un nodo`);
  }
  assert.equal(contarMarcador(html, 'suscripcionPlanes.nombre4'), 0, 'el plan 4 está oculto (sin nombre) — nada que marcar');
  assert.equal(contarMarcador(html, 'suscripcionPlanes.descripcion4'), 0);
  // `ctaLabel` es el MISMO campo repetido en cada tarjeta visible (3) — mismo criterio aceptado que
  // el campo duplicado de marquesina/HeroMediaMarquesina (§ EDICION-INLINE.md § 9): editar cualquiera
  // de las copias debe escribir el mismo campo.
  assert.equal(contarMarcador(html, 'suscripcionPlanes.ctaLabel'), 3);
});

test('SuscripcionPlanes, CON modo editor (DEFAULTS): los beneficios VISIBLES del plan 1 marcan `ben1_1..3` por su N real — `ben1_4` (vacío) no marca nada', () => {
  const html = renderConProvider(React.createElement(SuscripcionPlanes, { whatsapp: '+573000000000' }), DEFAULTS as SiteContentData, { activo: true });
  for (const n of [1, 2, 3]) {
    assert.equal(contarMarcador(html, `suscripcionPlanes.ben1_${n}`), 1, `ben1_${n} debería marcar un nodo`);
  }
  assert.equal(contarMarcador(html, 'suscripcionPlanes.ben1_4'), 0);
});

test('SuscripcionPlanes, CON modo editor y ben2_2 VACÍO (hueco en MEDIO, no al final): el segundo beneficio VISIBLE del plan 2 sigue marcando "ben2_3" (su N real), no "ben2_2"', () => {
  const content = { ...DEFAULTS, suscripcionPlanes: { ...DEFAULTS.suscripcionPlanes, ben2_2: '' } } as SiteContentData;
  const html = renderConProvider(React.createElement(SuscripcionPlanes, { whatsapp: '+573000000000' }), content, { activo: true });
  assert.equal(contarMarcador(html, 'suscripcionPlanes.ben2_1'), 1);
  assert.equal(contarMarcador(html, 'suscripcionPlanes.ben2_2'), 0);
  assert.equal(contarMarcador(html, 'suscripcionPlanes.ben2_3'), 1);
});

test('SuscripcionPlanes, CON modo editor y precio1 cargado: el PRECIO se sigue viendo pero SIN marcador — no se edita desde el editor (§ el spec de este slice, decisión del owner)', () => {
  const content = { ...DEFAULTS, suscripcionPlanes: { ...DEFAULTS.suscripcionPlanes, precio1: '$50.000/mes' } } as SiteContentData;
  const html = renderConProvider(React.createElement(SuscripcionPlanes, { whatsapp: '+573000000000' }), content, { activo: true });
  assert.ok(html.includes('$50.000/mes'), 'el precio debe seguir viéndose');
  assert.equal(contarMarcador(html, 'suscripcionPlanes.precio1'), 0, 'el precio NUNCA lleva marcador de campo editable');
  assert.doesNotMatch(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO_IMAGEN}="suscripcionPlanes\\.precio1"`));
});

// ─── SuscripcionPasos ──────────────────────────────────────────────────────────────────────────────

test('SuscripcionPasos, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(SuscripcionPasos), DEFAULTS as SiteContentData);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

test('SuscripcionPasos, CON modo editor (DEFAULTS, cardinalidad FIJA 4): titulo y los CUATRO pares paso*Label/paso*Desc marcan su nodo, cada uno una sola vez', () => {
  const html = renderConProvider(React.createElement(SuscripcionPasos), DEFAULTS as SiteContentData, { activo: true });
  assert.equal(contarMarcador(html, 'suscripcionPasos.titulo'), 1);
  for (const n of [1, 2, 3, 4]) {
    assert.equal(contarMarcador(html, `suscripcionPasos.paso${n}Label`), 1, `paso${n}Label debería marcar un nodo`);
    assert.equal(contarMarcador(html, `suscripcionPasos.paso${n}Desc`), 1, `paso${n}Desc debería marcar un nodo`);
    assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="suscripcionPasos\\.paso${n}Desc"[^>]*${ATRIBUTO_EDITOR_LINEA}="multiple"`));
  }
});

// ─── PreguntasFrecuentes (`suscripcionFaq`) — § EDITOR-TIENDA-CAMPO-EDITABLE-CIERRE-1 ──────────────
//
// Cierra el único hueco nombrado de la fila 4 de § 6.4 de EDICION-INLINE.md: este componente vive
// FUERA de `app/(storefront)/suscripciones/`/`components/storefront/{home,nosotros,suscripciones}/`
// (es compartido con `/tienda` y `/preguntas-frecuentes`, § su propio docstring) y por eso quedó sin
// instrumentar en `-PAGINAS-1`. `items: []` (DEFAULTS) es hide-on-empty — el componente entero rinde
// `null`; el fixture de abajo trae ítems propios, como ya hacen testimonios/galería.

const FAQ_FIXTURE = {
  ...DEFAULTS,
  suscripcionFaq: {
    ...DEFAULTS.suscripcionFaq,
    items: [
      { question: '¿Puedo pausar mi suscripción?', answer: 'Sí, escríbenos por WhatsApp.' },
      { question: '¿Cómo cambio mi dirección?', answer: 'Desde el mismo chat, antes del próximo envío.' },
    ],
  },
} as SiteContentData;

test('PreguntasFrecuentes, SIN modo editor: cero `data-editor-campo` — byte-idéntico', () => {
  const html = renderConProvider(React.createElement(PreguntasFrecuentes), FAQ_FIXTURE);
  assert.doesNotMatch(html, new RegExp(ATRIBUTO_EDITOR_CAMPO));
});

test('PreguntasFrecuentes, CON modo editor: titulo marca su nodo, y question/answer de CADA ítem marcan su ruta `suscripcionFaq.items.N.campo` — answer multilinea', () => {
  const html = renderConProvider(React.createElement(PreguntasFrecuentes), FAQ_FIXTURE, { activo: true });
  assert.equal(contarMarcador(html, 'suscripcionFaq.titulo'), 1);
  for (let i = 0; i < 2; i++) {
    assert.equal(contarMarcador(html, `suscripcionFaq.items.${i}.question`), 1, `items.${i}.question debería marcar un nodo`);
    assert.equal(contarMarcador(html, `suscripcionFaq.items.${i}.answer`), 1, `items.${i}.answer debería marcar un nodo`);
    assert.match(html, new RegExp(`${ATRIBUTO_EDITOR_CAMPO}="suscripcionFaq\\.items\\.${i}\\.answer"[^>]*${ATRIBUTO_EDITOR_LINEA}="multiple"`));
  }
});
