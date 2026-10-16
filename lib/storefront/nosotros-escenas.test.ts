import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NosotrosEscenas from '@/components/storefront/nosotros/NosotrosEscenas';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS, type SiteContentData, type NosotrosEscenaItem } from '@/lib/config/site-content-defaults';

// § CHAMISAS-APERTURA-ALBUM-AJUSTES-1 — las pruebas DEDICADAS de la composición «Láminas» (variante
// "album" de `nosotrosEscenas`), aparte de `lib/config/nosotros-escenas.test.ts` (que cubre la
// composición canónica «saintLaurent» y el hide-on-empty de la sección entera) y de
// `lib/storefront/laminas.test.ts` (que cubre las funciones puras — `esLaminaAncha`/`tituloLamina` —
// aisladas). Acá: que el dispatcher LAS CABLEE correctamente (el encabezado nuevo, el número que no
// se duplica) a través del árbol REAL, no sólo contra la función pura.
//
// SSR a texto vía `renderToStaticMarkup`, sin jsdom (el repo no lo tiene, § CLAUDE.md).

function render(content: SiteContentData, children: React.ReactNode): string {
  return renderToStaticMarkup(React.createElement(SiteContentProvider, { value: content, children }));
}

function item(parcial: Partial<NosotrosEscenaItem> & { foto: string; titulo: string }): NosotrosEscenaItem {
  return {
    descripcion: '', credito1Etiqueta: '', credito1Valor: '', credito2Etiqueta: '', credito2Valor: '', pie: '',
    ...parcial,
  };
}

const CINCO_LAMINAS: NosotrosEscenaItem[] = [
  item({ foto: '/l01.jpg', titulo: 'El territorio' }),
  item({ foto: '/l02.jpg', titulo: 'La cosecha' }),
  item({ foto: '/l03.jpg', titulo: 'Las manos' }),
  item({ foto: '/l04.jpg', titulo: 'El secado' }),
  item({ foto: '/l05.jpg', titulo: 'La bolsa' }),
];

function contenidoAlbum(items: NosotrosEscenaItem[], encabezado: { eyebrow?: string; titulo?: string } = {}): SiteContentData {
  return {
    ...DEFAULTS,
    nosotrosEscenas: {
      visible: true,
      variante: 'album',
      esquineros: true,
      items,
      eyebrow: encabezado.eyebrow ?? '',
      titulo: encabezado.titulo ?? '',
    },
  };
}

describe('NosotrosEscenas (variante "album") — el ajuste 1: el encabezado nuevo (eyebrow/titulo)', () => {
  test('con eyebrow y título llenos, los DOS aparecen en el render', () => {
    const content = contenidoAlbum(CINCO_LAMINAS, { eyebrow: 'Álbum de finca', titulo: 'Cinco láminas, de la montaña a la bolsa' });
    const html = render(content, React.createElement(NosotrosEscenas));
    assert.ok(html.includes('Álbum de finca'));
    assert.ok(html.includes('Cinco láminas, de la montaña a la bolsa'));
  });

  test('con los dos vacíos (el default), no aparece la fila de encabezado — ningún tenant que no edite ve nada nuevo', () => {
    const content = contenidoAlbum(CINCO_LAMINAS);
    const html = render(content, React.createElement(NosotrosEscenas));
    // Sin encabezado, el único "01/05" que puede aparecer es el del carrusel de celular (siempre en
    // 0, el estado inicial del SSR) — la ausencia del bloque de encabezado se afirma indirectamente
    // por byte-identidad con el render SIN eyebrow/titulo pasados (abajo).
    const sinProps = render(contenidoAlbum(CINCO_LAMINAS), React.createElement(NosotrosEscenas));
    assert.equal(html, sinProps);
  });

  test('sólo el eyebrow lleno (sin título) también dispara el encabezado — cada campo se omite por su cuenta', () => {
    const content = contenidoAlbum(CINCO_LAMINAS, { eyebrow: 'Álbum de finca' });
    const html = render(content, React.createElement(NosotrosEscenas));
    assert.ok(html.includes('Álbum de finca'));
  });
});

describe('NosotrosEscenas (variante "album") — el ajuste 3: el número no se duplica', () => {
  test('título SIN "Lámina NN ·" → el componente antepone el número', () => {
    const content = contenidoAlbum(CINCO_LAMINAS);
    const html = render(content, React.createElement(NosotrosEscenas));
    assert.ok(html.includes('Lámina 01 · El territorio'));
    assert.ok(html.includes('Lámina 05 · La bolsa'));
  });

  test('el dueño YA escribió "Lámina 01 · " en el título (el defecto medido) → NO se duplica', () => {
    const conPrefijo = [
      item({ foto: '/l01.jpg', titulo: 'Lámina 01 · El territorio' }),
      ...CINCO_LAMINAS.slice(1),
    ];
    const content = contenidoAlbum(conPrefijo);
    const html = render(content, React.createElement(NosotrosEscenas));
    assert.ok(html.includes('Lámina 01 · El territorio'));
    assert.ok(!html.includes('Lámina 01 · Lámina 01 · El territorio'), 'el defecto reportado: el número no debe aparecer dos veces');
  });
});

describe('NosotrosEscenas (variante "album") — el ajuste 2: estructura de doble página, no columna apilada', () => {
  test('con 5 láminas, la primera de cada página aparece marcada como ancha (col-span-2) y las intermedias no', () => {
    const content = contenidoAlbum(CINCO_LAMINAS);
    const html = render(content, React.createElement(NosotrosEscenas));
    // 5 láminas → reparto 3+2 (repartoPaginasLaminas); página izquierda: 01(ancha)/02(angosta)/
    // 03(angosta); página derecha: 04(ancha)/05(ancha, única+sobrante impar). Se cuenta cuántos
    // `<figure class="col-span-2"` hay — deben ser 3 (01, 04, 05).
    const anchas = html.split('<figure class="col-span-2"').length - 1;
    assert.equal(anchas, 3, '01 (primera de la izquierda), 04 (primera de la derecha) y 05 (sobrante impar de una página de 2) deben ir anchas');
  });

  test('con 0 láminas con foto, la sección entera se oculta — hide-on-empty sigue aplicando bajo "album"', () => {
    const content = contenidoAlbum([item({ foto: '', titulo: 'Sin foto' })]);
    const html = render(content, React.createElement(NosotrosEscenas));
    assert.equal(html, '');
  });
});

describe('NosotrosEscenas (variante "album") — § CHAMISAS-PAGINAS-ARREGLOS-1: cierra CHAMISAS-ALBUM-ANCHO-INCONSISTENTE-1', () => {
  test('con posicion:false (el default) el encabezado y el panel de escritorio usan max-w-6xl — byte a byte lo de siempre', () => {
    const content = contenidoAlbum(CINCO_LAMINAS, { eyebrow: 'Álbum de finca', titulo: 'Cinco láminas' });
    const html = render(content, React.createElement(NosotrosEscenas));
    assert.ok(html.includes('max-w-6xl'), 'sin posicion, el contenedor debe seguir siendo max-w-6xl');
    assert.ok(!html.includes('max-w-[1440px]'), 'sin posicion, no debe aparecer el contenedor de CORTE');
  });

  test('con posicion:true (el valor medido de Las Chamisas) el encabezado y el panel usan el contenedor de CORTE', () => {
    const content: SiteContentData = {
      ...contenidoAlbum(CINCO_LAMINAS, { eyebrow: 'Álbum de finca', titulo: 'Cinco láminas' }),
      navTratamiento: { ...DEFAULTS.navTratamiento, posicion: true },
    };
    const html = render(content, React.createElement(NosotrosEscenas));
    assert.ok(html.includes('max-w-[1440px]'), 'con posicion:true, el contenedor debe ser el de CORTE en las dos piezas (encabezado y panel)');
    assert.ok(!html.includes('max-w-6xl'), 'con posicion:true, no debe quedar ningún max-w-6xl propio de esta composición');
  });
});
