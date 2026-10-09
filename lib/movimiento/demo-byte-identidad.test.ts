// BYTE-IDENTIDAD (§ MOVIMIENTO-MARCO-GSAP-1, Cierre del spec) — `renderToStaticMarkup` con el
// contenido EN MEMORIA, sin tocar una base ni un `.env`: ni `resolverInstancia` ni la sección real
// `components/storefront/secciones/Texto.tsx` (FUERA de `touches:` de este slice, sin un solo
// cambio) leen el campo `animacion` nuevo, así que agregarlo al modelo no puede mover un byte de
// lo que el visitante ve HOY. Es el "antes y después" que el spec pide, medido contra el
// componente REAL, no una copia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SeccionTexto from '@/components/storefront/secciones/Texto';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS } from '@/lib/config/site-content-defaults';
import { resolverInstancia } from '@/lib/config/secciones-instancias';
import Movimiento from '@/components/storefront/movimiento/Movimiento';
import EjemploSeccionTexto from '@/components/storefront/movimiento/EjemploSeccionTexto';

function renderTexto(stored: Record<string, unknown>): string {
  const instancia = resolverInstancia(stored);
  return renderToStaticMarkup(
    createElement(SiteContentProvider, {
      value: DEFAULTS,
      children: createElement(SeccionTexto, { id: 'inst:prueba', instancia: instancia as never }),
    }),
  );
}

test('byte-identidad: "texto" sin `animacion` en el stored vs. con `animacion` EXPLÍCITO en «Ninguna» — mismo HTML', () => {
  const sinCampo = renderTexto({ tipo: 'texto', titulo: 'Un título', texto: 'Un párrafo.' });
  const conNinguna = renderTexto({ tipo: 'texto', titulo: 'Un título', texto: 'Un párrafo.', animacion: '' });
  assert.equal(sinCampo, conNinguna, 'ausente y «Ninguna» explícito deben producir el MISMO HTML');
});

test('byte-identidad: elegir una animación REAL del catálogo en `animacion` NO mueve un byte del HTML de "texto" HOY', () => {
  const sinAnimar = renderTexto({ tipo: 'texto', titulo: 'Un título', texto: 'Un párrafo.' });
  const conAnimacion = renderTexto({ tipo: 'texto', titulo: 'Un título', texto: 'Un párrafo.', animacion: 'T05' });
  assert.equal(sinAnimar, conAnimacion, 'Texto.tsx no lee instancia.animacion todavía -- el campo nuevo es invisible para el storefront real');
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
