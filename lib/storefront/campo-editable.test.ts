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

test('estiloCampoFlotante: geometría en fixed + tipografía spread + z-index al tope', () => {
  const estilo = estiloCampoFlotante(
    { top: 10, left: 20, width: 300, height: 40 },
    {
      fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', fontStyle: 'normal',
      lineHeight: '24px', letterSpacing: '0px', textAlign: 'left', textTransform: 'none',
      color: 'rgb(0, 0, 0)', padding: '0px',
    },
  );
  assert.equal(estilo.position, 'fixed');
  assert.equal(estilo.top, 10);
  assert.equal(estilo.left, 20);
  assert.equal(estilo.width, 300);
  assert.equal(estilo.height, 40);
  assert.equal(estilo.fontFamily, 'Inter');
  assert.equal(estilo.color, 'rgb(0, 0, 0)');
  assert.equal(estilo.background, 'transparent');
  assert.equal(estilo.border, 'none');
  assert.equal(estilo.boxSizing, 'border-box');
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
