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

describe('NosotrosAperturaAlbum — § CHAMISAS-NOSOTROS-ARCO-Y-FICHA-1: la caja que recorta la foto lleva SU PROPIO `relative`', () => {
  test('la caja `overflow-hidden rounded-t-full` declara `relative` — sin él, el `<Image fill>` resuelve su caja de contención contra el wrapper exterior y el recorte/radio queda sin efecto visual (medido: `position: static` + sin curva en un build real)', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    assert.ok(
      html.includes('relative aspect-[4/5] max-h-[55vh] overflow-hidden rounded-t-full'),
      'la caja que recorta la foto al arco debe llevar `relative` junto a `overflow-hidden rounded-t-full` — el mismo patrón que `InterludioRetrato` (piezas-compartidas.test.ts)',
    );
  });

  test('el wrapper EXTERIOR del sticker sigue llevando su propio `relative` (el ajuste 2 no se revierte)', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    // § CHAMISAS-NOSOTROS-FIDELIDAD-1: el ancho mobile pasó de `w-[78%]` a `w-full` (el defecto
    // medido — "en celular el arco ocupa 78% del ancho en vez del ancho completo"); el `relative`
    // que esta prueba afirma no se tocó, sólo el valor de ancho que lo acompaña en la misma clase.
    assert.ok(html.includes('class="relative w-full lg:w-[72%]"'), 'el wrapper que separa la caja recortada del sticker debe seguir siendo `relative`');
  });
});

describe('NosotrosAperturaAlbum — § CHAMISAS-NOSOTROS-ARCO-E-INTERLUDIO-1: la cúpula despeja el encabezado fijo', () => {
  test('la sección lleva `pt-24 lg:pt-28` — mayor que el alto del header (`h-16 lg:h-18` = 64/72px) MÁS el aire medido contra la maqueta, nunca el `pt-7 lg:pt-10` viejo que el header tapaba', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    assert.ok(html.includes('class="bg-[var(--sf-fondo)] pt-24 lg:pt-28"'), 'la sección debe declarar el padding-top nuevo');
    assert.ok(!html.includes('pt-7'), 'el pt-7 viejo (28px, menor que el header de 64px) no debe sobrevivir');
    assert.ok(!html.includes('lg:pt-10'), 'el lg:pt-10 viejo (40px, menor que el header de 72px) no debe sobrevivir');
  });

  test('sigue SIN min-h — el fix es sólo el padding-top, nunca una altura mínima que reintroduzca la banda vacía que cerró § CHAMISAS-APERTURA-ALBUM-AJUSTES-1', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    assert.ok(!/\bmin-h-\[/.test(html), 'ningún min-h arbitrario debe quedar en el grid que compone texto+arco');
  });
});

// § CHAMISAS-PAGINAS-ARREGLOS-1 — el swap a `contenedorAnchoClase(navTratamiento.posicion)` (§ el
// docstring de cabecera del componente) SE JUSTIFICA con esta aritmética, no con una suposición: el
// ancho INTERIOR disponible para el grid texto+arco nunca encoge frente al `max-w-[1376px] px-6
// sm:px-10 lg:px-16` que esta pieza tenía antes de este slice — con `posicion:true` (el valor MEDIDO
// de Las Chamisas, § el docstring de cabecera) en TODO breakpoint. Los números son los MISMOS
// literales que `lib/config/themes.ts` ya documenta para `contenedorAnchoClase` — no una segunda
// medición: si esa función cambiara sus literales, este test seguiría afirmando la relación (NUEVO
// ≥ VIEJO), no un número fijo.
describe('NosotrosAperturaAlbum — el ancho del contenedor nunca encoge al pasar a contenedorAnchoClase(true)', () => {
  // ANCHO INTERIOR = min(viewport, maxWidth) − 2×padding, en el breakpoint dado.
  function anchoInteriorViejo(viewportPx: number): number {
    // `max-w-[1376px] px-6 sm:px-10 lg:px-16` — a 390px (<640=sm) el padding es `px-6`=24px; a
    // 1440px (≥1024=lg) es `lg:px-16`=64px.
    const padding = viewportPx < 640 ? 24 : 64;
    return Math.min(viewportPx, 1376) - 2 * padding;
  }
  function anchoInteriorNuevo(viewportPx: number): number {
    // `contenedorAnchoClase(true)` = `max-w-[1440px] px-[18px] min-[640px]:px-6 cortenav:px-8` — a
    // 390px (<640) el padding es `px-[18px]`=18px; a 1440px (≥1200=cortenav) es `cortenav:px-8`=32px.
    const padding = viewportPx < 640 ? 18 : 32;
    return Math.min(viewportPx, 1440) - 2 * padding;
  }

  test('a 390px (celular, la captura de referencia): 354px ≥ 342px', () => {
    assert.equal(anchoInteriorViejo(390), 342);
    assert.equal(anchoInteriorNuevo(390), 354);
    assert.ok(anchoInteriorNuevo(390) >= anchoInteriorViejo(390));
  });

  test('a 1440px (escritorio, la captura de referencia): 1376px ≥ 1248px', () => {
    assert.equal(anchoInteriorViejo(1440), 1248);
    assert.equal(anchoInteriorNuevo(1440), 1376);
    assert.ok(anchoInteriorNuevo(1440) >= anchoInteriorViejo(1440));
  });

  test('la relación NUEVO ≥ VIEJO se sostiene en una barrida de viewports, no sólo en los dos medidos', () => {
    for (let v = 320; v <= 1920; v += 10) {
      assert.ok(anchoInteriorNuevo(v) >= anchoInteriorViejo(v), `viewport ${v}px: nuevo(${anchoInteriorNuevo(v)}) < viejo(${anchoInteriorViejo(v)})`);
    }
  });
});

describe('NosotrosAperturaAlbum — § CHAMISAS-PAGINAS-ARREGLOS-1: el ancho sigue a navTratamiento.posicion', () => {
  test('con posicion:false (el default, sin fila) usa el contenedor de SIEMPRE (max-w-6xl), no el de CORTE', () => {
    const html = render(DEFAULTS, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    assert.ok(html.includes('max-w-6xl'), 'sin posicion, el contenedor debe ser el de siempre (max-w-6xl px-4 sm:px-6 lg:px-8)');
    assert.ok(!html.includes('max-w-[1376px]'), 'el ancho propio de esta pieza ya no debe sobrevivir en el árbol');
    assert.ok(!html.includes('max-w-[1440px]'), 'sin posicion, no debe aparecer el contenedor de CORTE');
  });

  test('con posicion:true (el valor medido de Las Chamisas) usa el contenedor de CORTE (max-w-[1440px])', () => {
    const content: SiteContentData = { ...DEFAULTS, navTratamiento: { ...DEFAULTS.navTratamiento, posicion: true } };
    const html = render(content, React.createElement(NosotrosAperturaAlbum, PROPS_BASE));
    assert.ok(html.includes('max-w-[1440px]'), 'con posicion:true, el contenedor debe ser el de CORTE');
    assert.ok(!html.includes('max-w-6xl'), 'con posicion:true, no debe quedar el contenedor de siempre');
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
