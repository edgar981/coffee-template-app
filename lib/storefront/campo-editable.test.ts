import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsearRutaCampo, fusionCampoEditable, estiloCampoFlotante, ATRIBUTO_EDITOR_CAMPO_IMAGEN } from './campo-editable';

import HeroCurtina from '@/components/storefront/home/HeroCurtina';
import HeroFicha from '@/components/storefront/home/HeroFicha';
import HeroMedia from '@/components/storefront/home/HeroMedia';
import HeroMediaMarquesina from '@/components/storefront/home/HeroMediaMarquesina';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { ModoEditorProvider } from '@/components/storefront/ModoEditor';
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
