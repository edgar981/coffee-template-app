// BYTE-IDENTIDAD (§ MOVIMIENTO-MARCO-GSAP-1, extendida por § MOVIMIENTO-EDITOR-EXPOSICION-1) —
// `renderToStaticMarkup` con el contenido EN MEMORIA, sin tocar una base ni un `.env`. El contrato
// de ESTE slice es el inverso del de arriba: las NUEVE secciones reales SÍ leen `instancia.animacion`
// ahora (§ cada una envuelve su elemento objetivo en `<Movimiento>`), así que el requisito pasa a
// ser "con «Ninguna» (ausente o explícito), byte-idéntico a antes de este slice — con una animación
// REAL elegida, el HTML SÍ cambia (ahí vive el nuevo wrapper que el motor de GSAP anima del lado
// del cliente)". Las nueve se miden abajo, por el MISMO par ausente/«Ninguna» que ya cubría a
// "texto" sola.
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
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
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
