import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SuscripcionPlanes from '@/components/storefront/suscripciones/SuscripcionPlanes';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS, type SuscripcionPlanesContent } from '@/lib/config/site-content-defaults';

// § Backlog #49, FIX A — el gate observó que un plan DESTACADO con nombre vacío SEGUÍA mostrándose. El
// test del HELPER (`planesDeSuscripcion`) afirmaba el filtro, pero el owner pidió el caso cubierto a
// nivel del COMPONENTE. Este renderiza el COMPONENTE REAL (`renderToStaticMarkup` con su
// `SiteContentProvider`, sin PreviewProvider → tienda pública) y afirma sobre el HTML. Habría fallado
// con el `req:true` viejo (plan 1 forzado a mostrarse aun vacío).

function render(sec: SuscripcionPlanesContent): string {
  const content = { ...DEFAULTS, suscripcionPlanes: sec };
  return renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(SuscripcionPlanes) }),
  );
}
const nTarjetas = (html: string) => (html.match(/rounded-2xl p-6/g) || []).length;

// DERIVADO de DEFAULTS (§ CONTENIDO-NEUTRALIZAR-4): antes comparaba contra los nombres LITERALES
// ('Plan 250 g'/'Plan 500 g'/'Plan Familiar'), una TERCERA declaración del mismo contenido que
// `site-content-defaults.ts` — el mismo patrón que `opcionesDestaque` ya pagó en
// `planes-suscripcion.test.ts`. Lo que esta prueba afirma no es CUÁLES son los nombres, sino que el
// COMPONENTE los pinta en el HTML y no se los come: si `SuscripcionPlanes` dejara de leer `nombreN`
// del contenido (un fallback hardcodeado, un campo cambiado por otro), esta prueba lo atrapa igual.
test('COMPONENTE: Nayoli renderiza 3 tarjetas, con "Más Popular" en la destacada (slot 2)', () => {
  const html = render(DEFAULTS.suscripcionPlanes);
  assert.equal(nTarjetas(html), 3);
  const { nombre1, nombre2, nombre3 } = DEFAULTS.suscripcionPlanes;
  assert.ok(html.includes(nombre1) && html.includes(nombre2) && html.includes(nombre3),
    'los nombres CONFIGURADOS llegan al HTML — el componente los pinta, no se los come');
  assert.ok(html.includes('Más Popular'));
});

test('COMPONENTE (FIX A): un plan DESTACADO (slot 1, requerido) con nombre vacío NO se renderiza', () => {
  const html = render({ ...DEFAULTS.suscripcionPlanes, destacadoSlot: '1', nombre1: '' });
  assert.equal(nTarjetas(html), 2, 'sólo los planes 2 y 3 (con nombre); el 1 destacado sin nombre se filtra');
  assert.ok(!html.includes('Más Popular'), 'sin nombre no hay tarjeta → no hay badge de destacado colgando');
});

test('COMPONENTE (FIX A): un plan OPCIONAL destacado (slot 3) con nombre vacío tampoco se muestra', () => {
  const html = render({ ...DEFAULTS.suscripcionPlanes, destacadoSlot: '3', nombre3: '' });
  assert.equal(nTarjetas(html), 2, 'sólo los planes 1 y 2');
  assert.ok(!html.includes('Más Popular'));
});

test('COMPONENTE: el precio se muestra sólo si NO está vacío (Nayoli no lleva → no aparece)', () => {
  assert.ok(!render(DEFAULTS.suscripcionPlanes).includes('font-bold text-[var(--sf-tinta)] mb-1'),
    'sin precio no se pinta el bloque de precio');
  const conPrecio = render({ ...DEFAULTS.suscripcionPlanes, precio1: '$ 45.000/mes' });
  assert.ok(conPrecio.includes('$ 45.000/mes'), 'con precio, se pinta');
});
