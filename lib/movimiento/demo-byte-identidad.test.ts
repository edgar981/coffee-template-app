// BYTE-IDENTIDAD (§ MOVIMIENTO-MARCO-GSAP-1, extendida por § MOVIMIENTO-EDITOR-EXPOSICION-1 y por
// § MOVIMIENTO-NIVEL-EDITORIAL-1) — `renderToStaticMarkup` con el contenido EN MEMORIA, sin tocar
// una base ni un `.env`. El contrato de MOVIMIENTO-EDITOR-EXPOSICION-1 es el inverso del original:
// las NUEVE secciones reales SÍ leen `instancia.animacion` (§ cada una envuelve su elemento objetivo
// en `<Movimiento>`), así que el requisito pasa a ser "con «Ninguna» (ausente o explícito),
// byte-idéntico a antes de ese slice — con una animación REAL elegida, el HTML SÍ cambia (ahí vive
// el nuevo wrapper que el motor de GSAP anima del lado del cliente)". Las nueve se miden abajo, por
// el MISMO par ausente/«Ninguna» que ya cubría a "texto" sola.
//
// MOVIMIENTO-NIVEL-EDITORIAL-1 suma motor a T06/S01/S02/S03, y con ellos el contrato se matiza: NO
// toda animación nueva cambia el HTML servido — `Movimiento` no agrega NINGÚN atributo cuando monta
// una etiqueta (ni ref, ni clase nueva), así que S01 (que envuelve la SECCIÓN, no un elemento con
// contenido propio) da HTML IDÉNTICO al de «Ninguna»; T06 y S03, en cambio, SÍ agregan contenido
// propio (el título gigante; la tira horizontal) y por eso el HTML SÍ cambia. Cada test de abajo
// dice CUÁL de las dos formas le corresponde y por qué — ver la sección "T06/S01/S02/S03" más abajo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SeccionTexto from '@/components/storefront/secciones/Texto';
import SeccionImagenTexto from '@/components/storefront/secciones/ImagenTexto';
import SeccionBanner from '@/components/storefront/secciones/Banner';
import SeccionPreguntas from '@/components/storefront/secciones/Preguntas';
import SeccionColumnas from '@/components/storefront/secciones/Columnas';
import SeccionFilas from '@/components/storefront/secciones/Filas';
import SeccionCollage from '@/components/storefront/secciones/Collage';
import SeccionVideo from '@/components/storefront/secciones/Video';
import SeccionCarrusel from '@/components/storefront/secciones/Carrusel';
import SeccionProceso from '@/components/storefront/secciones/Proceso';
import SeccionCierre from '@/components/storefront/secciones/Cierre';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';
import { DEFAULTS } from '@/lib/config/site-content-defaults';
import { resolverInstancia } from '@/lib/config/secciones-instancias';
import Movimiento from '@/components/storefront/movimiento/Movimiento';
import EjemploSeccionTexto from '@/components/storefront/movimiento/EjemploSeccionTexto';

type ComponenteSeccion = (props: { id: string; instancia: unknown; style?: unknown }) => unknown;

function render(Comp: ComponenteSeccion, stored: Record<string, unknown>): string {
  const instancia = resolverInstancia(stored);
  return renderToStaticMarkup(
    createElement(SiteContentProvider, {
      value: DEFAULTS,
      children: createElement(Comp as never, { id: 'inst:prueba', instancia: instancia as never }),
    }),
  );
}

function renderTexto(stored: Record<string, unknown>): string {
  return render(SeccionTexto as ComponenteSeccion, stored);
}

test('byte-identidad: "texto" sin `animacion` en el stored vs. con `animacion` EXPLÍCITO en «Ninguna» — mismo HTML', () => {
  const sinCampo = renderTexto({ tipo: 'texto', titulo: 'Un título', texto: 'Un párrafo.' });
  const conNinguna = renderTexto({ tipo: 'texto', titulo: 'Un título', texto: 'Un párrafo.', animacion: '' });
  assert.equal(sinCampo, conNinguna, 'ausente y «Ninguna» explícito deben producir el MISMO HTML');
});

test('byte-identidad: elegir una animación REAL del catálogo en `animacion` SÍ mueve el HTML de "texto" — ahí vive el <Movimiento> que el cliente anima', () => {
  const sinAnimar = renderTexto({ tipo: 'texto', titulo: 'Un título', texto: 'Un párrafo.' });
  const conAnimacion = renderTexto({ tipo: 'texto', titulo: 'Un título', texto: 'Un párrafo.', animacion: 'T05' });
  assert.notEqual(sinAnimar, conAnimacion, '§ MOVIMIENTO-EDITOR-EXPOSICION-1: Texto.tsx ya lee instancia.animacion -- elegir una SÍ cambia el HTML');
});

// ─── LAS NUEVE SECCIONES, byte-idénticas con «Ninguna» — § MOVIMIENTO-EDITOR-EXPOSICION-1 ────────
//
// Cada caso trae datos de fixture representativos (texto + imagen + items, según el tipo) para que
// el componente real recorra TODAS sus ramas (con imagen, con CTA, con ítems) y el ausente/«Ninguna»
// siga dando el MISMO HTML en cada una -- no sólo en el caso vacío, que ejercitaría menos ramas.
const CASOS_NUEVE: [string, ComponenteSeccion, Record<string, unknown>][] = [
  ['texto', SeccionTexto as ComponenteSeccion, { tipo: 'texto', antetitulo: 'Eyebrow', titulo: 'Un título', texto: 'Un párrafo.', ctaLabel: 'Ver más', ctaDestino: '/tienda' }],
  ['imagenTexto', SeccionImagenTexto as ComponenteSeccion, { tipo: 'imagenTexto', titulo: 'Un título', texto: 'Cuerpo', imagen: '/x.jpg', lado: 'derecha' }],
  ['banner', SeccionBanner as ComponenteSeccion, { tipo: 'banner', titulo: 'B', texto: 'Cuerpo', imagen: '/x.jpg', ctaLabel: 'Ir', ctaDestino: '/tienda' }],
  ['preguntas', SeccionPreguntas as ComponenteSeccion, { tipo: 'preguntas', titulo: 'FAQ', items: [{ pregunta: '¿Envío?', respuesta: 'Sí.' }, { pregunta: '¿Pago?', respuesta: 'Sí.' }] }],
  ['columnas', SeccionColumnas as ComponenteSeccion, { tipo: 'columnas', titulo: 'Col', items: [{ imagen: '/a.jpg', titulo: 'A', texto: 'ta' }, { imagen: '/b.jpg', titulo: 'B', texto: 'tb' }] }],
  ['filas', SeccionFilas as ComponenteSeccion, { tipo: 'filas', titulo: 'Filas', items: [{ imagen: '/a.jpg', titulo: 'A', texto: 'ta' }, { imagen: '/b.jpg', titulo: 'B', texto: 'tb' }] }],
  ['collage', SeccionCollage as ComponenteSeccion, { tipo: 'collage', titulo: 'Col', items: [{ url: '/a.jpg', leyenda: 'A' }, { url: '/b.jpg', leyenda: 'B' }, { url: '/c.jpg', leyenda: 'C' }] }],
  ['video', SeccionVideo as ComponenteSeccion, { tipo: 'video', titulo: 'V', texto: 'Cuerpo', imagen: '/v.mp4', poster: '/p.jpg' }],
  ['carrusel', SeccionCarrusel as ComponenteSeccion, { tipo: 'carrusel', titulo: 'Car', items: [{ imagen: '/a.jpg', titulo: 'A', texto: 'ta' }, { imagen: '/b.jpg', titulo: 'B', texto: 'tb' }] }],
];

for (const [nombre, Comp, stored] of CASOS_NUEVE) {
  test(`byte-identidad: "${nombre}" -- ausente vs. «Ninguna» explícito dan el MISMO HTML (el eje nuevo no mueve nada hoy)`, () => {
    const sinCampo = render(Comp, stored);
    const conNinguna = render(Comp, { ...stored, animacion: '' });
    assert.equal(sinCampo, conNinguna);
  });
}

// ─── § MOVIMIENTO-NIVEL-EDITORIAL-1 — T06 SOBRE LA FOTO, S01 SOBRE LA SECCIÓN, S03 COMO MODO ─────
//
// Las CUATRO animaciones que este slice suma motor (T06/S01/S02/S03) tocan CUATRO de los archivos
// de `CASOS_NUEVE` arriba (banner, imagenTexto, texto, collage) — así que primero se re-afirma que
// esos CUATRO siguen dando el MISMO HTML ausente/«Ninguna» (ya cubierto por el loop de arriba, sin
// cambios de fixture) y DESPUÉS se afirma que elegir la animación nueva SÍ mueve algo — el mismo
// contrato que la T05 de "texto" ya probaba para el eje original.

test('byte-identidad: "banner" con T06 — con foto Y título, el HTML cambia (el título gigante se monta sobre la foto)', () => {
  const stored = { tipo: 'banner', titulo: 'Un título', imagen: '/x.jpg' };
  const sinAnimar = render(SeccionBanner as ComponenteSeccion, stored);
  const conT06 = render(SeccionBanner as ComponenteSeccion, { ...stored, animacion: 'T06' });
  assert.notEqual(sinAnimar, conT06);
  assert.match(conT06, /sf-movimiento-gigante/);
});

test('byte-identidad: "banner" con T06 pero SIN foto — el HTML es IDÉNTICO: sin `instancia.imagen`, Banner.tsx va al hueco "+Agregar foto" y nunca llega a consultar `animacion`', () => {
  const stored = { tipo: 'banner', titulo: 'Un título' };
  const sinAnimar = render(SeccionBanner as ComponenteSeccion, stored);
  const conT06 = render(SeccionBanner as ComponenteSeccion, { ...stored, animacion: 'T06' });
  assert.doesNotMatch(sinAnimar, /sf-movimiento-gigante/);
  assert.doesNotMatch(conT06, /sf-movimiento-gigante/);
  assert.equal(sinAnimar, conT06, 'el branch `instancia.imagen ? … : HuecoImagenOpcional` decide ANTES de mirar `animacion`');
});

test('byte-identidad: "imagenTexto" con T06 -- mismo contrato que banner', () => {
  const stored = { tipo: 'imagenTexto', titulo: 'Un título', imagen: '/x.jpg' };
  const sinAnimar = render(SeccionImagenTexto as ComponenteSeccion, stored);
  const conT06 = render(SeccionImagenTexto as ComponenteSeccion, { ...stored, animacion: 'T06' });
  assert.notEqual(sinAnimar, conT06);
  assert.match(conT06, /sf-movimiento-gigante/);
});

test('byte-identidad: "texto" con S01 -- el HTML es IDÉNTICO al de «Ninguna»: la prueba de que el TÍTULO sigue en RevelarBloque, no en Movimiento', () => {
  // `Movimiento` no agrega NINGÚN atributo serializable cuando monta una etiqueta (§ el contrato de
  // `<Movimiento id="">`de arriba: "sin wrapper, sin ref, sin clase" -- un `ref` no se serializa en
  // SSR) -- así que envolver la SECCIÓN con `<Movimiento id="S01" as="section">` en vez de un
  // `<section>` plano no cambia el string renderizado: el efecto de S01 (tiñe el FONDO por GSAP del
  // lado del cliente) vive enteramente en el DOM post-hidratación, nunca en el HTML servido. Lo que
  // SÍ sería visible es el defecto que esta prueba previene: si `animacionTitulo` no se limpiara, el
  // título pasaría de `RevelarBloque` (framer-motion, que SÍ estampa un `style` inicial en SSR) a
  // `<Movimiento id="S01" as="h2">` (sin ese `style`) -- y ahí el HTML SÍ cambiaría.
  const stored = { tipo: 'texto', titulo: 'Un título' };
  const sinAnimar = render(SeccionTexto as ComponenteSeccion, stored);
  const conS01 = render(SeccionTexto as ComponenteSeccion, { ...stored, animacion: 'S01' });
  assert.equal(sinAnimar, conS01);
});

test('byte-identidad: "collage" con `disposicion:\'horizontal\'` (S03) -- mosaico grande+chicas reemplazado por la tira pineada', () => {
  const stored = { tipo: 'collage', items: [{ url: '/a.jpg', leyenda: 'A' }, { url: '/b.jpg', leyenda: 'B' }, { url: '/c.jpg', leyenda: 'C' }] };
  const mosaico = render(SeccionCollage as ComponenteSeccion, stored);
  const horizontal = render(SeccionCollage as ComponenteSeccion, { ...stored, disposicion: 'horizontal' });
  assert.notEqual(mosaico, horizontal);
});

// ─── § MOVIMIENTO-NIVEL-EDITORIAL-1 — "proceso" (S02) ─────────────────────────────────────────
//
// SIN eje `animacion` que elegir (§ el descriptor): no hay "ausente vs. «Ninguna»" que comparar.
// Lo que se afirma es que SIEMPRE monta `<Movimiento id="S02">` con sus marcadores -- y que el modo
// `quieto` (preview/editor) cambia la clase de ALTURA sin tocar los marcadores que el motor lee.
function renderProceso(stored: Record<string, unknown>, preview = false): string {
  const instancia = resolverInstancia(stored);
  const children = createElement(SeccionProceso, { id: 'inst:prueba', instancia: instancia as never });
  const envuelto = preview ? createElement(PreviewProvider, { children }) : children;
  return renderToStaticMarkup(createElement(SiteContentProvider, { value: DEFAULTS, children: envuelto }));
}

test('"proceso": SIEMPRE monta `<Movimiento id="S02">` -- data-s02-paso por cada ítem, data-s02-objeto en el lienzo', () => {
  const html = renderProceso({ tipo: 'proceso', items: [{ titulo: 'A', texto: 'ta' }, { titulo: 'B', texto: 'tb' }, { titulo: 'C', texto: 'tc' }] });
  assert.equal((html.match(/data-s02-paso/g) ?? []).length, 3);
  assert.match(html, /data-s02-objeto/);
});

test('"proceso": el modo QUIETO (preview) usa la altura normal de sección, no `h-screen` -- el pin del motor está apagado ahí', () => {
  const stored = { tipo: 'proceso', items: [{ titulo: 'A', texto: 'ta' }, { titulo: 'B', texto: 'tb' }, { titulo: 'C', texto: 'tc' }] };
  const real = renderProceso(stored, false);
  const quieto = renderProceso(stored, true);
  assert.match(real, /h-screen/);
  assert.doesNotMatch(quieto, /h-screen/);
  assert.match(quieto, /py-20/);
});

test('"proceso": con foto en el primer paso, aparece su capa `data-s02-foto="0"` -- sin foto, no hay ninguna capa de foto', () => {
  const conFoto = renderProceso({ tipo: 'proceso', items: [{ titulo: 'A', texto: 'ta', imagen: '/a.jpg' }, { titulo: 'B', texto: 'tb' }, { titulo: 'C', texto: 'tc' }] });
  assert.match(conFoto, /data-s02-foto="0"/);
  const sinFoto = renderProceso({ tipo: 'proceso', items: [{ titulo: 'A', texto: 'ta' }, { titulo: 'B', texto: 'tb' }, { titulo: 'C', texto: 'tc' }] });
  assert.doesNotMatch(sinFoto, /data-s02-foto/);
});

// EL CONTRATO DE `<Movimiento>` MISMO (no el de Texto.tsx): `id` ausente/«Ninguna» no debe montar
// NINGÚN nodo propio -- children directo, sin wrapper, sin ref, sin clase.
test('<Movimiento id="">: devuelve los children SIN wrapper -- byte-idéntico a no usar el componente', () => {
  // La comparación es contra los CHILDREN SOLOS -- `{titulo}` a secas, sin que nadie los envuelva
  // en nada -- que es lo que una sección escribiría HOY, sin `<Movimiento>`.
  const hijo = () => createElement('span', null, 'Un título');
  const desnudo = renderToStaticMarkup(createElement('h2', null, hijo()));
  const envuelto = renderToStaticMarkup(createElement('h2', null, createElement(Movimiento, { id: '', children: hijo() })));
  assert.equal(envuelto, desnudo, '«Ninguna» no agrega NINGÚN nodo: el h2 ve el <span> directo, como si <Movimiento> no existiera');

  const envueltoUndefined = renderToStaticMarkup(createElement('h2', null, createElement(Movimiento, { children: hijo() })));
  assert.equal(envueltoUndefined, desnudo, 'id ausente (undefined) se comporta igual que id=""');
});

test('<Movimiento id="T05" as="h2">: SÍ monta la etiqueta pedida (hay algo que animar del lado del cliente)', () => {
  const envuelto = renderToStaticMarkup(createElement(Movimiento, { id: 'T05', as: 'h2', children: 'Un título' }));
  assert.match(envuelto, /^<h2>Un título<\/h2>$/, 'con un id presente, SÍ hay un wrapper -- el servidor no corre GSAP, pero el nodo existe para que el cliente lo anime');
});

// EL EJEMPLO DE CABLEADO (§ EjemploSeccionTexto.tsx) — con el default de HOY (`animacion: ''`, toda
// tienda real incluida Nayoli) renderiza EXACTAMENTE como si <Movimiento> no existiera.
test('EjemploSeccionTexto: con instancia.animacion="" (el default de hoy), el título sale SIN wrapper', () => {
  const instancia = resolverInstancia({ tipo: 'texto', titulo: 'Un título' }) as import('@/lib/config/secciones-instancias').InstanciaTextoContent;
  const html = renderToStaticMarkup(createElement(EjemploSeccionTexto, { instancia }));
  assert.equal(html, '<section>Un título</section>');
});

test('EjemploSeccionTexto: con instancia.animacion="T01" monta el <h2> que el cliente va a animar', () => {
  const instancia = resolverInstancia({ tipo: 'texto', titulo: 'Un título', animacion: 'T01' }) as import('@/lib/config/secciones-instancias').InstanciaTextoContent;
  const html = renderToStaticMarkup(createElement(EjemploSeccionTexto, { instancia }));
  assert.equal(html, '<section><h2>Un título</h2></section>');
});

// ─── § MOVIMIENTO-NIVEL-FIRMA-1 — "cierre" (CTA01, "Vapor que forma el llamado") ─────────────────
//
// SIN eje `animacion` que elegir (§ el descriptor, como "proceso"): siempre monta
// `<Movimiento id="CTA01">` con sus marcadores — el vapor (tres trazos), la frase y el botón
// (cuando hay destino).
function renderCierre(stored: Record<string, unknown>): string {
  return render(SeccionCierre as ComponenteSeccion, stored);
}

test('"cierre": SIEMPRE monta `<Movimiento id="CTA01">` -- tres `data-cta01-vapor`, una `data-cta01-frase`', () => {
  const html = renderCierre({ tipo: 'cierre', titulo: 'Lleva nuestra historia a tu taza' });
  assert.equal((html.match(/data-cta01-vapor/g) ?? []).length, 3);
  assert.match(html, /data-cta01-frase/);
});

test('"cierre": SIN destino (ctaLabel/ctaDestino vacíos), el botón no se monta -- sin `data-cta01-boton`', () => {
  const html = renderCierre({ tipo: 'cierre', titulo: 'T' });
  assert.doesNotMatch(html, /data-cta01-boton/);
});

test('"cierre": CON ctaLabel y un destino del set cerrado, el botón SÍ se monta', () => {
  const html = renderCierre({ tipo: 'cierre', titulo: 'T', ctaLabel: 'Comprar café', ctaDestino: '/tienda' });
  assert.match(html, /data-cta01-boton/);
});

// § MOVIMIENTO-CIERRE-BOTON-1 — LA CAUSA REAL, confirmada por ejecución (Chromium real): el botón
// quedaba invisible porque su className llevaba `transition-all`, una transición CSS sobre TODAS
// sus propiedades que competía con el `.from(boton, {autoAlpha:0})` de GSAP sobre la MISMA
// propiedad (`opacity`/`visibility`, § `cta01()` en `animaciones.ts`). Medido en las DOS
// direcciones: con `transition-all` puesto, el botón quedaba en `opacity:0` aun completando su
// tween (en Chromium real); quitándolo (→ `transition-transform`, sólo lo que el hover
// `-translate-y-0.5` necesita), revela bien. Este test es la única red DENTRO de `npm test` contra
// que alguien le devuelva `transition-all` al CTA creyendo que es "la clase de siempre" — la
// EJECUCIÓN real vive en el gate visual, no acá.
test('"cierre": el botón NUNCA lleva `transition-all` -- compite con el `autoAlpha` de GSAP sobre `opacity`/`visibility` y lo deja invisible (§ MOVIMIENTO-CIERRE-BOTON-1, medido en Chromium real)', () => {
  const html = renderCierre({ tipo: 'cierre', titulo: 'T', ctaLabel: 'Comprar café', ctaDestino: '/tienda' });
  const botonMatch = html.match(/<a data-cta01-boton[^>]*class="([^"]*)"/);
  assert.ok(botonMatch, 'el botón debe montarse con su className a la vista');
  const claseBoton = botonMatch![1];
  assert.doesNotMatch(claseBoton, /\btransition-all\b/);
  assert.match(claseBoton, /\btransition-transform\b/, 'el hover `-translate-y-0.5` sigue necesitando una transición, sólo que acotada a `transform`');
});

// ─── § MOVIMIENTO-NIVEL-FIRMA-1 — HeroSection con la variante CANÓNICA ("curtina") no cambia ─────
//
// El dispatcher (`HeroSection.tsx`) ganó TRES entradas nuevas en su mapa VARIANTES
// ('grano'/'cereza'/'paisaje'), pero con `hero.variante` ausente (la canónica, byte-idéntica a
// Nayoli hoy) sigue eligiendo `HeroCurtina` -- ésta prueba que agregar entradas a un `Record` no
// toca la que ya resolvía.
test('HeroSection: sin `variante` (canónica "curtina"), el HTML NO contiene ningún marcador de los héroes de firma', async () => {
  const { default: HeroSection } = await import('@/components/storefront/home/HeroSection');
  const html = renderToStaticMarkup(
    createElement(SiteContentProvider, { value: DEFAULTS, children: createElement(HeroSection) }),
  );
  assert.doesNotMatch(html, /data-h01-|data-h02-|data-h03-/);
});

// ─── LAS TRES COMPOSICIONES DE FIRMA, cada una monta SUS PROPIOS marcadores ─────────────────────

async function renderHeroVariante(variante: string, heroExtra: Record<string, unknown> = {}): Promise<string> {
  const { default: HeroSection } = await import('@/components/storefront/home/HeroSection');
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, variante, ...heroExtra } };
  return renderToStaticMarkup(
    createElement(SiteContentProvider, { value: content as never, children: createElement(HeroSection) }),
  );
}

test('HeroSection "grano": monta `<Movimiento id="H01">` con el grano en reposo (opacity-0) y las dos ondas', async () => {
  const html = await renderHeroVariante('grano');
  assert.match(html, /data-h01-grano/);
  assert.match(html, /data-h01-onda1/);
  assert.match(html, /data-h01-onda2/);
  assert.match(html, /data-h01-titulo/);
});

test('HeroSection "cereza": monta `<Movimiento id="H02">` con la cereza y el fruto', async () => {
  const html = await renderHeroVariante('cereza');
  assert.match(html, /data-h02-cereza/);
  assert.match(html, /data-h02-fruto/);
  assert.match(html, /data-h02-titulo/);
});

test('HeroSection "paisaje" SIN `hero.imagen`: cae a la ilustración, CUATRO capas `data-h03-capa`', async () => {
  const html = await renderHeroVariante('paisaje', { imagen: '' });
  assert.equal((html.match(/data-h03-capa/g) ?? []).length, 4);
  assert.match(html, /data-h03-titulo/);
});

test('HeroSection "paisaje" CON `hero.imagen`: UNA sola capa de parallax sobre la foto real', async () => {
  const html = await renderHeroVariante('paisaje', { imagen: '/finca.jpg', imagenTipo: 'imagen' });
  assert.equal((html.match(/data-h03-capa/g) ?? []).length, 1);
  assert.match(html, /finca\.jpg/);
});
