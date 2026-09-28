import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NosotrosHistoria from '@/components/storefront/nosotros/NosotrosHistoria';
import NosotrosGaleria from '@/components/storefront/nosotros/NosotrosGaleria';
import NosotrosCierre from '@/components/storefront/nosotros/NosotrosCierre';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import {
  DEFAULTS,
  BANDA_NOSOTROS_IDS,
  resolverOrdenNosotros,
  type BandaNosotrosId,
  type SiteContentData,
} from './site-content-defaults';

// § NOSOTROS-SISTEMA-DE-BANDAS-1, ampliado por § NOSOTROS-COMPOSICION-1. `app/(storefront)/
// nosotros/page.tsx` deja de montar sus secciones con `import`s fijos y pasa a resolver su orden +
// su registro de bandas, igual que la home (`resolverOrden` + el `BANDAS` de
// `app/(storefront)/page.tsx`). El sistema de bandas fue un REFACTOR PURO (byte-idéntico para todo
// tenant); `nosotrosCierre` es la primera COMPOSICIÓN nueva que se apoya en él — hide-on-empty, así
// que con contenido VACÍO (los DEFAULTS) sigue siendo byte-idéntica al árbol de ayer.
//
// Vive en `lib/config/` (no bajo `components/storefront/nosotros/`) por el mismo motivo que
// `renderGrindChooser` en `site-content-defaults.test.ts`: SSR a texto vía `renderToStaticMarkup`,
// sin jsdom (el repo no lo tiene, § CLAUDE.md), y el glob del carril rápido ya cubre
// `lib/**/*.test.ts`. `NosotrosHistoria`/`NosotrosGaleria`/`NosotrosCierre` son 'use client' sin
// import server-only (leen `useSiteContent()`/`useIsPreview()`, ambos con provider/default seguros
// en Node) — página.tsx NO se puede importar acá (arrastra `getSiteContent`/`getSiteSettings`,
// `server-only`), así que la prueba de byte-identidad se hace contra el ÁRBOL, no contra la ruta.

// EL ÁRBOL DE AYER: los DOS componentes que `page.tsx` montaba ANTES de § NOSOTROS-COMPOSICION-1 (la
// historia + la galería, sin el cierre). Es la referencia contra la que se mide la byte-identidad
// cuando `nosotrosCierre` está VACÍO (hide-on-empty) — el caso de todo tenant que no lo llene.
function arbolFijo(content: SiteContentData, negocio: string) {
  return React.createElement(SiteContentProvider, {
    value: content,
    children: [
      React.createElement(NosotrosHistoria, { key: 'nosotrosHistoria' }),
      React.createElement(NosotrosGaleria, { key: 'nosotrosGaleria', negocio }),
    ],
  });
}

// EL REGISTRO bandaId→render, construido igual que `page.tsx` lo construye: `Record<BandaNosotrosId,
// …>` exhaustivo por TIPO — si `BANDA_NOSOTROS_IDS` gana un id y nadie lo registra acá, esto NO
// compila. `nosotrosGaleria` es la única banda con un prop extra (`negocio`), igual que
// `presentaciones` en el registro de la home; `nosotrosCierre` no toma props, como `nosotrosHistoria`.
const BANDAS: Record<BandaNosotrosId, (negocio: string) => React.ReactNode> = {
  nosotrosHistoria: () => React.createElement(NosotrosHistoria),
  nosotrosGaleria: (negocio) => React.createElement(NosotrosGaleria, { negocio }),
  nosotrosCierre: () => React.createElement(NosotrosCierre),
};

// EL ÁRBOL DE HOY: `resolverOrdenNosotros()` + el registro de arriba — el mismo mecanismo que
// `page.tsx` usa desde este slice.
function arbolResuelto(content: SiteContentData, negocio: string) {
  return React.createElement(SiteContentProvider, {
    value: content,
    children: resolverOrdenNosotros().map((id) => React.createElement(React.Fragment, { key: id }, BANDAS[id](negocio))),
  });
}

test('resolverOrdenNosotros: devuelve las TRES bandas de /nosotros, en el orden de hoy — el cierre AL FINAL', () => {
  assert.deepEqual(resolverOrdenNosotros(), ['nosotrosHistoria', 'nosotrosGaleria', 'nosotrosCierre']);
});

test('el registro bandaId→render es EXHAUSTIVO: toda banda de BANDA_NOSOTROS_IDS tiene una entrada registrada', () => {
  for (const id of BANDA_NOSOTROS_IDS) {
    assert.ok(id in BANDAS, `falta el registro de la banda "${id}"`);
  }
  assert.equal(Object.keys(BANDAS).length, BANDA_NOSOTROS_IDS.length);
});

test('byte-identidad: galería VACÍA y cierre VACÍO (hide-on-empty los dos) — el árbol resuelto por registro+resolver es idéntico al JSX fijo de ayer', () => {
  const negocio = 'Café Nayoli';
  const viejo = renderToStaticMarkup(arbolFijo(DEFAULTS, negocio));
  const nuevo = renderToStaticMarkup(arbolResuelto(DEFAULTS, negocio));
  assert.equal(nuevo, viejo);
  assert.ok(viejo.length > 0, 'la historia debe renderizar algo, aun con la galería oculta');
});

test('byte-identidad: galería CON fotos — el árbol resuelto sigue idéntico, ejercitando las DOS bandas visibles (el cierre sigue vacío)', () => {
  const negocio = 'Café Nayoli';
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosGaleria: {
      ...DEFAULTS.nosotrosGaleria,
      items: [{ url: '/images/nosotros-1.jpg', alt: 'Una foto de la finca' }],
    },
  };
  const viejo = renderToStaticMarkup(arbolFijo(content, negocio));
  const nuevo = renderToStaticMarkup(arbolResuelto(content, negocio));
  assert.equal(nuevo, viejo);
  // El `alt` es texto del owner, y `next/image` lo deja LITERAL (a diferencia del `src`, que el
  // loader reescribe) — es el discriminador confiable de que la banda de galería SÍ renderizó.
  assert.ok(viejo.includes('Una foto de la finca'), 'la galería con fotos debe aparecer en el HTML');
});

test('NosotrosGaleria (banda): con items vacíos sigue devolviendo null — el hide-on-empty no cambió', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, {
      value: DEFAULTS,
      children: React.createElement(NosotrosGaleria, { negocio: 'Café Nayoli' }),
    }),
  );
  assert.equal(html, '');
});

// § NOSOTROS-COMPOSICION-1: `nosotrosCierre` es la PRIMERA banda nueva que compone sobre el
// habilitador de § NOSOTROS-SISTEMA-DE-BANDAS-1. Con `titulo` vacío (el default) no monta nada —los
// dos tests de byte-identidad de arriba dependen exactamente de esto—; con `titulo` presente, rinde
// y aparece al FINAL del árbol resuelto, después de historia y galería (§ el orden, arriba).

test('NosotrosCierre (banda): con `titulo` vacío devuelve null — hide-on-empty (no es un repeater, el gate vive en el componente)', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(NosotrosCierre) }),
  );
  assert.equal(html, '');
});

test('NosotrosCierre (banda): con `titulo` presente SÍ renderiza — titular, párrafo y botón — y aparece AL FINAL del árbol resuelto', () => {
  const negocio = 'Café Nayoli';
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosCierre: {
      ...DEFAULTS.nosotrosCierre,
      titulo: 'Conocé la finca',
      parrafo: 'Te esperamos con los brazos abiertos.',
      ctaLabel: 'Ir a la tienda',
      ctaDestino: '/tienda',
    },
  };
  const html = renderToStaticMarkup(arbolResuelto(content, negocio));
  assert.ok(html.includes('Conocé la finca'), 'el titular del cierre debe aparecer');
  assert.ok(html.includes('Te esperamos con los brazos abiertos.'), 'el párrafo del cierre debe aparecer');
  assert.ok(html.includes('Ir a la tienda'), 'el botón del cierre debe aparecer');
  // El cierre aparece DESPUÉS del título de la historia — confirma que el orden lo pone al final.
  assert.ok(html.indexOf(DEFAULTS.nosotrosHistoria.titulo) < html.indexOf('Conocé la finca'));
});

test('NosotrosCierre (banda): sin `ctaLabel`/`ctaDestino` no rinde ningún botón (resolverCtaSeccion → null)', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosCierre: { ...DEFAULTS.nosotrosCierre, titulo: 'Conocé la finca' },
  };
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(NosotrosCierre) }),
  );
  assert.ok(html.includes('Conocé la finca'));
  assert.ok(!html.includes('<a '), 'sin CTA resuelto, ningún <a> debe rendir');
});
