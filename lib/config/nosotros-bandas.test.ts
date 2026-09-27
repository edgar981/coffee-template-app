import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NosotrosHistoria from '@/components/storefront/nosotros/NosotrosHistoria';
import NosotrosGaleria from '@/components/storefront/nosotros/NosotrosGaleria';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import {
  DEFAULTS,
  BANDA_NOSOTROS_IDS,
  resolverOrdenNosotros,
  type BandaNosotrosId,
  type SiteContentData,
} from './site-content-defaults';

// § NOSOTROS-SISTEMA-DE-BANDAS-1. `app/(storefront)/nosotros/page.tsx` deja de montar sus dos
// secciones con dos `import`s fijos y pasa a resolver su orden + su registro de bandas, igual que
// la home (`resolverOrden` + el `BANDAS` de `app/(storefront)/page.tsx`). ESTE SLICE ES UN REFACTOR
// PURO: instala el habilitador de la composición, no la composición — la salida tiene que ser
// BYTE-IDÉNTICA a la de ayer, para todo tenant, Nayoli incluida.
//
// Vive en `lib/config/` (no bajo `components/storefront/nosotros/`) por el mismo motivo que
// `renderGrindChooser` en `site-content-defaults.test.ts`: SSR a texto vía `renderToStaticMarkup`,
// sin jsdom (el repo no lo tiene, § CLAUDE.md), y el glob del carril rápido ya cubre
// `lib/**/*.test.ts`. `NosotrosHistoria`/`NosotrosGaleria` son 'use client' sin import server-only
// (leen `useSiteContent()`/`useIsPreview()`, ambos con provider/default seguros en Node) — página.tsx
// NO se puede importar acá (arrastra `getSiteContent`/`getSiteSettings`, `server-only`), así que la
// prueba de byte-identidad se hace contra el ÁRBOL, no contra la ruta.

// El ÁRBOL DE AYER: los dos componentes en el orden JSX fijo que `page.tsx` montaba antes de este
// slice. Es la referencia contra la que se mide la byte-identidad.
function arbolFijo(content: SiteContentData, negocio: string) {
  return React.createElement(SiteContentProvider, {
    value: content,
    children: [
      React.createElement(NosotrosHistoria, { key: 'nosotrosHistoria' }),
      React.createElement(NosotrosGaleria, { key: 'nosotrosGaleria', negocio }),
    ],
  });
}

// EL REGISTRO bandaId→render, construido igual que `page.tsx` lo construye desde este slice:
// `Record<BandaNosotrosId, …>` exhaustivo por TIPO — si `BANDA_NOSOTROS_IDS` gana un id y nadie lo
// registra acá, esto NO compila. `nosotrosGaleria` es la única banda con un prop extra (`negocio`),
// igual que `presentaciones` en el registro de la home.
const BANDAS: Record<BandaNosotrosId, (negocio: string) => React.ReactNode> = {
  nosotrosHistoria: () => React.createElement(NosotrosHistoria),
  nosotrosGaleria: (negocio) => React.createElement(NosotrosGaleria, { negocio }),
};

// EL ÁRBOL DE HOY: `resolverOrdenNosotros()` + el registro de arriba — el mismo mecanismo que
// `page.tsx` usa desde este slice.
function arbolResuelto(content: SiteContentData, negocio: string) {
  return React.createElement(SiteContentProvider, {
    value: content,
    children: resolverOrdenNosotros().map((id) => React.createElement(React.Fragment, { key: id }, BANDAS[id](negocio))),
  });
}

test('resolverOrdenNosotros: devuelve las dos bandas de /nosotros, en el orden de hoy', () => {
  assert.deepEqual(resolverOrdenNosotros(), ['nosotrosHistoria', 'nosotrosGaleria']);
});

test('el registro bandaId→render es EXHAUSTIVO: toda banda de BANDA_NOSOTROS_IDS tiene una entrada registrada', () => {
  for (const id of BANDA_NOSOTROS_IDS) {
    assert.ok(id in BANDAS, `falta el registro de la banda "${id}"`);
  }
  assert.equal(Object.keys(BANDAS).length, BANDA_NOSOTROS_IDS.length);
});

test('byte-identidad: galería VACÍA (hide-on-empty) — el árbol resuelto por registro+resolver es idéntico al JSX fijo de ayer', () => {
  const negocio = 'Café Nayoli';
  const viejo = renderToStaticMarkup(arbolFijo(DEFAULTS, negocio));
  const nuevo = renderToStaticMarkup(arbolResuelto(DEFAULTS, negocio));
  assert.equal(nuevo, viejo);
  assert.ok(viejo.length > 0, 'la historia debe renderizar algo, aun con la galería oculta');
});

test('byte-identidad: galería CON fotos — el árbol resuelto sigue idéntico, ejercitando las DOS bandas visibles', () => {
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
