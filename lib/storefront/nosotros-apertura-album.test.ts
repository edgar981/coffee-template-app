import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NosotrosAperturaAlbum from '@/components/storefront/nosotros/NosotrosAperturaAlbum';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS, type SiteContentData } from '@/lib/config/site-content-defaults';

// § CHAMISAS-APERTURA-ALBUM-AJUSTES-1 — las pruebas DEDICADAS de la Apertura «Álbum», aparte de
// `nosotros-bandas.test.ts` (que cubre el registro bandaId→render) y de
// `lib/config/site-content-defaults.test.ts` (que cubre el resolver). Acá: la REGLA del layout que
// cerró el defecto #1 (sin `min-h` forzado en el grid, § NosotrosAperturaAlbum.tsx) y la regla del
// orden en celular (texto antes del arco, § el defecto #3 del spec — las clases `order-1`/`order-2`
// estaban invertidas respecto del propio comentario del archivo).
//
// SSR a texto vía `renderToStaticMarkup`, sin jsdom (el repo no lo tiene, § CLAUDE.md). El
// componente es 'use client' sin import server-only (lee `useIsPreview()`, con default seguro en
// Node, § PreviewMode.tsx).

function render(content: SiteContentData, children: React.ReactNode): string {
  return renderToStaticMarkup(React.createElement(SiteContentProvider, { value: content, children }));
}

const PROPS_BASE = {
  eyebrow: 'Nosotros · San Adolfo, Huila',
  titulo: 'Nuestro territorio, sus manos, nuestro orgullo.',
  bajada: 'Somos mujeres y familias que cultivan café en San Adolfo, Huila.',
  imagen: '/images/hero-cerezas-v1.jpg',
  sticker: 'Cosecha 2026',
  franjaTejido: '',
};

describe('NosotrosAperturaAlbum — el ajuste 1 del spec: sin min-h forzado, sin banda vacía', () => {
  test('el grid NO declara un min-h fijo — el defecto medido (§ CHAMISAS-APERTURA-ALBUM-AJUSTES-1): `lg:min-h-[640px]` forzaba el alto más allá del contenido y dejaba una banda vacía arriba', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    assert.ok(!html.includes('lg:min-h-[640px]'), 'la clase vieja de min-h no debe sobrevivir en el árbol');
    assert.ok(!/\bmin-h-\[/.test(html), 'ningún min-h arbitrario debe quedar en el grid que compone texto+arco');
  });

  test('el arco cae a un tope de 600px en escritorio, no sólo al 55vh de celular — ambos topes conviven, cada uno en su breakpoint', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    assert.ok(html.includes('max-h-[55vh]'), 'el tope de celular (55vh) debe seguir presente');
    assert.ok(html.includes('lg:max-h-[600px]'), 'el tope de escritorio (600px, § la maqueta ".arch{height:min(600px,…)}") debe estar declarado');
  });
});

describe('NosotrosAperturaAlbum — el ajuste 3 del spec: en celular el texto va PRIMERO', () => {
  test('el eyebrow/título/bajada aparecen ANTES que la imagen del arco en el HTML — orden DOM, no sólo clases CSS', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    const posTitulo = html.indexOf(PROPS_BASE.titulo);
    // `next/image` reescribe `src` a `/_next/image?url=<encodeURIComponent(imagen)>…` en SSR — se
    // busca el `<img` en sí, no la URL cruda (que nunca aparece literal en el HTML).
    const posImagen = html.indexOf('<img');
    assert.ok(posTitulo !== -1, 'el título debe aparecer en el HTML');
    assert.ok(posImagen !== -1, 'la imagen del arco debe aparecer en el HTML');
    assert.ok(posTitulo < posImagen, 'el título (columna de texto) debe preceder a la imagen del arco en el DOM — el defecto medido los tenía invertidos vía order-1/order-2');
  });

  test('la columna de texto lleva `order-1` y la del arco `order-2` — las clases coinciden con el comentario del archivo, que antes las tenía al revés', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    const idxTextoOrder1 = html.indexOf('order-1');
    const idxArcoOrder2 = html.indexOf('order-2');
    assert.ok(idxTextoOrder1 !== -1 && idxArcoOrder2 !== -1);
    assert.ok(idxTextoOrder1 < idxArcoOrder2, 'order-1 (texto) debe preceder a order-2 (arco) en el markup, reflejando que el texto es el primer elemento');
  });
});

describe('NosotrosAperturaAlbum — el ajuste 2 del spec: el sticker sale de la caja que recorta la foto', () => {
  test('el sticker NO es descendiente directo de un overflow-hidden que también lo clipearía — la estructura separa "caja que recorta" de "sticker que cuelga"', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    // La caja que recorta la foto (overflow-hidden + rounded-t-full) debe CERRAR su </div> ANTES de
    // que el sticker (el texto del sticker) aparezca — si el sticker viviera DENTRO de esa caja, su
    // texto aparecería ANTES del cierre del div que la contiene.
    const idxCajaRecorte = html.indexOf('overflow-hidden rounded-t-full');
    const idxSticker = html.indexOf(PROPS_BASE.sticker);
    assert.ok(idxCajaRecorte !== -1, 'la caja que recorta la foto al arco debe existir');
    assert.ok(idxSticker !== -1, 'el sticker debe aparecer en el HTML');
    assert.ok(idxCajaRecorte < idxSticker, 'el sticker debe ir DESPUÉS de donde abre la caja recortada (es su hermano siguiente, no un hijo que caería dentro de la misma máscara)');
  });

  test('el sticker se posiciona con top porcentual (relativo al arco) y cuelga del borde con un valor negativo — nunca un `top-8`/`right-3` fijo en px que lo deje adentro de la curva', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    assert.ok(html.includes('top-[12%]'), 'el sticker debe posicionarse al 12% de la altura del arco, como la maqueta');
    assert.ok(html.includes('-right-2'), 'el sticker debe colgar del borde derecho (valor negativo), no vivir adentro del arco');
  });
});

describe('NosotrosAperturaAlbum — sin sticker, sin imagen: no revienta, no deja residuos', () => {
  test('sticker vacío → no se monta ningún nodo con el texto del sticker', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, { ...PROPS_BASE, sticker: '' }));
    assert.ok(!html.includes('Cosecha 2026'));
  });

  test('imagen vacía → el hueco opcional se muestra, sin lanzar', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, { ...PROPS_BASE, imagen: '' }));
    assert.ok(html.length > 0);
    assert.ok(!html.includes('<img'), 'sin imagen no debe haber un <img> real (sólo el placeholder)');
  });
});
