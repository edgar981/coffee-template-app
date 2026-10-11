import { test } from 'node:test';
import assert from 'node:assert/strict';
// MISMA razón que `lib/tienda/piezas-compartidas.test.ts`: fuera del pipeline de build, `next/image`
// no recibe `ImageConfigContext` y clampea cualquier `quality` al default de fábrica (`[75]`). Se
// iguala a lo que `next.config.ts` → `images.qualities` ya declara, para medir lo que el navegador
// vería, no un artefacto del arnés.
import { imageConfigDefault } from 'next/dist/shared/lib/image-config';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Apertura from '@/components/storefront/tienda/Apertura';
import InterludioPlano from '@/components/storefront/tienda/InterludioPlano';
import { PreviewProvider } from '@/components/storefront/PreviewMode';

// § ONIX-APERTURA-MOVIL-INTERLUDIO-PARALLAX-1 — afirma la ESTRUCTURA que el motor necesita para
// arreglar el tirón de T06 (el ancla `.sf-movimiento-gigante`, que `t06()` localiza) y para que I03
// nunca exponga un borde vacío en el interludio (la capa sobredimensionada). El fotograma a
// fotograma del scrub (scroll vs. transform, bajo CPU×4/celular) y las capturas a mitad de scroll
// son capa 3 — medidos con Playwright en `.scratch/` de este slice y reportados en `DECISIONS.md`;
// este archivo mide lo que SÍ es verificable sin navegador: el árbol que `renderToStaticMarkup`
// produce, sin DB ni `.env` (§ el contrato del dispatch de este slice).

imageConfigDefault.qualities = [75, 85, 90];

function sinImagenes(html: string): string {
  return html.replace(/<img[^>]*\/>/g, '<img/>').replace(/<link rel="preload"[^>]*\/>/g, '');
}

// ─── APERTURA (T06) ──────────────────────────────────────────────────────────────────────────────

test('Apertura: el título gigante sigue anclado por `.sf-movimiento-gigante` — el ancla que `t06()` busca con `querySelector`', () => {
  const html = renderToStaticMarkup(React.createElement(Apertura, { titulo: 'FINCA SAN ADOLFO' }));
  assert.ok(
    html.includes('class="sf-movimiento-gigante'),
    'sin este marcador, t06() (animaciones.ts) devuelve null y no hay nada que animar',
  );
});

test('Apertura: `Movimiento` monta SIEMPRE su wrapper alrededor del título — el nodo donde `force3D` necesita que el `ScrollTrigger` ate su `trigger`', () => {
  const html = renderToStaticMarkup(React.createElement(Apertura, { titulo: 'FINCA SAN ADOLFO' }));
  // El wrapper de `as="div"` sin className propio (Apertura no le pasa uno) — un <div> liso
  // envolviendo el <h1>, nunca el <h1> suelto como hijo directo de la sección.
  assert.match(
    sinImagenes(html),
    /<div><h1 class="sf-movimiento-gigante[^>]*>FINCA SAN ADOLFO<\/h1><\/div>/,
    'el h1 debe seguir envuelto por el wrapper de Movimiento, igual en preview y fuera de preview',
  );
});

test('Apertura: el wrapper de Movimiento es BYTE-IDÉNTICO en preview y fuera de preview — el motor sólo decide SI corre GSAP, nunca si el nodo existe', () => {
  const props = { titulo: 'FINCA SAN ADOLFO' };
  const fueraDePreview = renderToStaticMarkup(React.createElement(Apertura, props));
  const enPreview = renderToStaticMarkup(
    React.createElement(PreviewProvider, { children: React.createElement(Apertura, props) }),
  );
  assert.equal(sinImagenes(enPreview), sinImagenes(fueraDePreview));
});

// ─── INTERLUDIO PLANO (I03, el parallax nuevo) ──────────────────────────────────────────────────

test('InterludioPlano: el parallax envuelve la foto en un marco (`Movimiento`, `absolute inset-0`) + una capa SOBREDIMENSIONADA (`-top-[12%] -bottom-[12%]`) que contiene la Image — el patrón exacto del prototipo aprobado (`.foto .capa{inset:-12% 0}`)', () => {
  const html = renderToStaticMarkup(
    React.createElement(InterludioPlano, { imagen: '/images/el-cafetal.jpg', pie: 'EL CAFETAL', preview: false }),
  );
  const sinImg = sinImagenes(html);
  assert.ok(
    sinImg.includes('<div class="absolute inset-0"><div class="absolute inset-x-0 -top-[12%] -bottom-[12%]"><img/></div></div>'),
    `estructura inesperada: ${sinImg}`,
  );
});

test('InterludioPlano: SIN pie, el marco de parallax sigue presente — el pie es independiente de la animación', () => {
  const html = renderToStaticMarkup(
    React.createElement(InterludioPlano, { imagen: '/images/el-cafetal.jpg', preview: false }),
  );
  assert.ok(sinImagenes(html).includes('<div class="absolute inset-0"><div class="absolute inset-x-0 -top-[12%] -bottom-[12%]"><img/></div></div>'));
  assert.ok(!html.includes('bg-gradient-to-t'), 'sin pie, no se monta el degradado del pie');
});

test('InterludioPlano: el marco de Movimiento es BYTE-IDÉNTICO con y sin `PreviewProvider` — el `preview` PROP (framer-motion) y el contexto `useIsPreview` (el gate del motor GSAP) son DOS mecanismos distintos; éste afirma el del motor, manteniendo el prop fijo', () => {
  const props = { imagen: '/images/el-cafetal.jpg', pie: 'EL CAFETAL', preview: false };
  const fueraDePreview = renderToStaticMarkup(React.createElement(InterludioPlano, props));
  const enPreviewDeEditor = renderToStaticMarkup(
    React.createElement(PreviewProvider, { children: React.createElement(InterludioPlano, props) }),
  );
  assert.equal(sinImagenes(enPreviewDeEditor), sinImagenes(fueraDePreview));
});

// ─── EL MARGEN DEL 12% CUBRE EL RECORRIDO DE I03 — matemática pura, la razón de "nunca expone un
// borde vacío" (§ animaciones.ts, i03(): yPercent -8 a 8, SIN tocar esos valores en este slice). ───

test('el margen del 12% (InterludioPlano) excede el recorrido real que i03() le pide a su capa sobredimensionada', () => {
  // i03() mueve la capa ±8% de SU PROPIA altura; la capa mide 100%+2×12%=124% del marco visible.
  // El recorrido, en términos del marco, es 8% × 1.24 ≈ 9.92% — debe quedar DEBAJO del margen del
  // 12% en cada lado, o el borde de la capa se asomaría dentro del marco recortado.
  const MARGEN_PORCENTAJE = 12;
  const YPERCENT_I03 = 8; // el valor HOY en animaciones.ts — ±8, sin cambios de este slice
  const altoCapaSobreMarco = 100 + 2 * MARGEN_PORCENTAJE;
  const recorridoEnTerminosDelMarco = (YPERCENT_I03 / 100) * altoCapaSobreMarco;
  assert.ok(
    recorridoEnTerminosDelMarco < MARGEN_PORCENTAJE,
    `el recorrido (${recorridoEnTerminosDelMarco}%) debe quedar bajo el margen (${MARGEN_PORCENTAJE}%) en cada lado`,
  );
  assert.equal(Math.round(recorridoEnTerminosDelMarco * 100) / 100, 9.92);
});
