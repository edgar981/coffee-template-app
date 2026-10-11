import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatCOP } from '@duna/core/utils';
import {
  frecuenciasDeTaquilla,
  bolsasDeTaquilla,
  segmentoMolienda,
  resumenTaquilla,
  referenciaPrecioTaquilla,
  mensajeTaquilla,
  creditosDeTaquilla,
} from './suscripcion-taquilla';
import { DEFAULTS, type SiteContentData } from '../config/site-content-defaults';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { navOffsetClase } from '../config/themes';
import SuscripcionApertura from '@/components/storefront/suscripciones/SuscripcionApertura';
import SuscripcionPlanes from '@/components/storefront/suscripciones/SuscripcionPlanes';
import SuscripcionPasos from '@/components/storefront/suscripciones/SuscripcionPasos';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';

// § ONIX-SUSCRIPCION-TAQUILLA-1. Dos mitades: las reglas PURAS de la Taquilla de suscripción
// (resumen, referencia de precio, mensaje de WhatsApp, para los cuatro modos de molienda) y la
// BYTE-IDENTIDAD de /suscripciones sin composiciones nuevas — mismo método que
// `lib/config/nosotros-bandas.test.ts`: SSR a texto vía `renderToStaticMarkup`, sin jsdom (el repo
// no lo tiene), comparando el árbol de HOY (resuelto por `page.tsx`, reconstruido acá porque ese
// archivo es server-only y no se puede importar en el carril) contra el árbol de AYER (lo que
// `Contenido.tsx` montaba antes de este slice).

// ─── frecuenciasDeTaquilla / bolsasDeTaquilla ──────────────────────────────────────────────────

test('frecuenciasDeTaquilla: filtra los slots vacíos, preserva el orden', () => {
  assert.deepEqual(frecuenciasDeTaquilla(['15 días', 'Mes', '2 meses', '']), ['15 días', 'Mes', '2 meses']);
  assert.deepEqual(frecuenciasDeTaquilla(['', '', '', '']), []);
  assert.deepEqual(frecuenciasDeTaquilla(['Semana', '', '', '']), ['Semana']);
});

test('bolsasDeTaquilla: 1..max, y un max inválido cae a 1', () => {
  assert.deepEqual(bolsasDeTaquilla(3), [1, 2, 3]);
  assert.deepEqual(bolsasDeTaquilla(1), [1]);
  assert.deepEqual(bolsasDeTaquilla(5), [1, 2, 3, 4, 5]);
  assert.deepEqual(bolsasDeTaquilla(0), [1]);
  assert.deepEqual(bolsasDeTaquilla(Number.NaN), [1]);
});

// ─── segmentoMolienda — los CUATRO modos de decidirMolienda ────────────────────────────────────

test('segmentoMolienda: modo "ninguna" → null (nada que decidir, nada que decir)', () => {
  assert.equal(segmentoMolienda({ modo: 'ninguna' }, null), null);
});

test('segmentoMolienda: modo "automatica" → "Molienda <nombre>", sin fila de elección', () => {
  assert.equal(segmentoMolienda({ modo: 'automatica', nombre: 'Media' }, null), 'Molienda Media');
});

test('segmentoMolienda: modo "eleccion" CON selección → "Molienda <seleccionada>"', () => {
  assert.equal(segmentoMolienda({ modo: 'eleccion' }, 'Prensa'), 'Molienda Prensa');
});

test('segmentoMolienda: modo "eleccion" SIN selección → null', () => {
  assert.equal(segmentoMolienda({ modo: 'eleccion' }, null), null);
});

test('segmentoMolienda: modo "agotada" → null (declara opciones, ninguna disponible)', () => {
  assert.equal(segmentoMolienda({ modo: 'agotada' }, null), null);
});

// ─── resumenTaquilla ────────────────────────────────────────────────────────────────────────────

test('resumenTaquilla: «2 × 250 G · MOLIENDA MEDIA · CADA MES» — con molienda', () => {
  assert.equal(
    resumenTaquilla({ bolsas: 2, peso: 250, segmentoMolienda: 'Molienda Media', frecuenciaEtiqueta: 'Mes' }),
    '2 × 250 G · MOLIENDA MEDIA · CADA MES',
  );
});

test('resumenTaquilla: sin segmento de molienda, el segmento se OMITE (no dos " · " seguidos)', () => {
  assert.equal(
    resumenTaquilla({ bolsas: 1, peso: 500, segmentoMolienda: null, frecuenciaEtiqueta: '15 días' }),
    '1 × 500 G · CADA 15 DÍAS',
  );
});

// ─── referenciaPrecioTaquilla ───────────────────────────────────────────────────────────────────

test('referenciaPrecioTaquilla: UNA bolsa, sin multiplicador', () => {
  // `formatCOP` (§ @duna/core/utils) es la fuente del formato — no se re-implementa acá el "$X.XXX"
  // a mano; este test fija el contrato (hay o no multiplicador), no el espaciado de la moneda.
  assert.equal(referenciaPrecioTaquilla(1, 20000), `Referencia: ${formatCOP(20000)}, precio de tienda por bolsa.`);
});

test('referenciaPrecioTaquilla: VARIAS bolsas, con multiplicador', () => {
  assert.equal(referenciaPrecioTaquilla(2, 20000), `Referencia: 2 × ${formatCOP(20000)}, precio de tienda por bolsa.`);
});

// ─── mensajeTaquilla — los CUATRO modos de molienda, en el mensaje exacto ──────────────────────

test('mensajeTaquilla: modo "ninguna" — sin cláusula de molienda, bolsa en singular', () => {
  assert.equal(
    mensajeTaquilla({ nombreProducto: 'Café Onix', bolsas: 1, peso: 250, segmentoMolienda: null, frecuenciaEtiqueta: 'Mes' }),
    'Hola, quiero suscribirme a Café Onix: 1 bolsa de 250 g, cada mes.',
  );
});

test('mensajeTaquilla: modo "automatica" — la cláusula de molienda en minúscula, bolsas en plural', () => {
  assert.equal(
    mensajeTaquilla({ nombreProducto: 'Café Onix', bolsas: 2, peso: 250, segmentoMolienda: 'Molienda Media', frecuenciaEtiqueta: 'Mes' }),
    'Hola, quiero suscribirme a Café Onix: 2 bolsas de 250 g, molienda media, cada mes.',
  );
});

test('mensajeTaquilla: modo "eleccion" con selección — la cláusula nombra la opción elegida', () => {
  assert.equal(
    mensajeTaquilla({ nombreProducto: 'Café Onix', bolsas: 1, peso: 500, segmentoMolienda: 'Molienda Prensa', frecuenciaEtiqueta: '2 meses' }),
    'Hola, quiero suscribirme a Café Onix: 1 bolsa de 500 g, molienda prensa, cada 2 meses.',
  );
});

test('mensajeTaquilla: modo "agotada" — mismo que "ninguna": sin cláusula de molienda', () => {
  assert.equal(
    mensajeTaquilla({ nombreProducto: 'Café Onix', bolsas: 1, peso: 250, segmentoMolienda: null, frecuenciaEtiqueta: '15 días' }),
    'Hola, quiero suscribirme a Café Onix: 1 bolsa de 250 g, cada 15 días.',
  );
});

// ─── creditosDeTaquilla ─────────────────────────────────────────────────────────────────────────

test('creditosDeTaquilla: con los DEFAULTS, los cuatro créditos del trato — ninguno fabricado', () => {
  assert.deepEqual(creditosDeTaquilla(DEFAULTS.suscripcionPlanes), [
    { etiqueta: 'Pedido', valor: 'Por WhatsApp' },
    { etiqueta: 'Pago', valor: 'Se acuerda por chat' },
    { etiqueta: 'Envío', valor: 'A todo el país' },
    { etiqueta: 'Pausa o cambio', valor: 'Con un mensaje' },
  ]);
});

test('creditosDeTaquilla: una fila a medias (sólo etiqueta o sólo valor) NO se muestra', () => {
  const c = { ...DEFAULTS.suscripcionPlanes, credito1Etiqueta: 'Pedido', credito1Valor: '' };
  assert.deepEqual(creditosDeTaquilla(c).map((x) => x.etiqueta), ['Pago', 'Envío', 'Pausa o cambio']);
});

// ─── BYTE-IDENTIDAD: /suscripciones sin composiciones nuevas == el árbol de ayer ───────────────
//
// `suscripcionApertura.visible` nace `false` y `suscripcionPlanes.variante` nace `'tarjetas'` (los
// DEFAULTS), así que para todo tenant sin fila la página debe verse EXACTAMENTE como antes de este
// slice: SuscripcionPlanes (tarjetas) + SuscripcionPasos + `<main>` con la FAQ, envueltos en el
// MISMO `navOffsetClase`.

function arbolDeAyer(content: SiteContentData, whatsapp: string) {
  return React.createElement(SiteContentProvider, {
    value: content,
    children: React.createElement(
      'div',
      { className: navOffsetClase(content.navTratamiento.posicion) },
      React.createElement(SuscripcionPlanes, { whatsapp }),
      React.createElement(SuscripcionPasos),
      React.createElement('main', { className: 'bg-[var(--sf-fondo)]' }, React.createElement(PreguntasFrecuentes)),
    ),
  });
}

function arbolDeHoy(content: SiteContentData, whatsapp: string) {
  return React.createElement(SiteContentProvider, {
    value: content,
    children: React.createElement(
      'div',
      { className: navOffsetClase(content.navTratamiento.posicion) },
      React.createElement(SuscripcionApertura),
      React.createElement(SuscripcionPlanes, { whatsapp }),
      React.createElement(SuscripcionPasos),
      React.createElement('main', { className: 'bg-[var(--sf-fondo)]' }, React.createElement(PreguntasFrecuentes)),
    ),
  });
}

test('byte-identidad: /suscripciones con los DEFAULTS (apertura apagada, variante "tarjetas") es idéntica al árbol de ayer', () => {
  const whatsapp = '573000000000';
  const viejo = renderToStaticMarkup(arbolDeAyer(DEFAULTS, whatsapp));
  const nuevo = renderToStaticMarkup(arbolDeHoy(DEFAULTS, whatsapp));
  assert.equal(nuevo, viejo);
  assert.ok(viejo.length > 0, 'la página debe renderizar algo con los defaults');
});

test('SuscripcionApertura: con `visible:false` (el default) no renderiza NADA — la apertura es hide-on-off, no hide-on-empty', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(SuscripcionApertura) }),
  );
  assert.equal(html, '');
});

test('SuscripcionApertura: con `visible:true` SÍ renderiza — el título por defecto «CADA MES» aparece', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    suscripcionApertura: { ...DEFAULTS.suscripcionApertura, visible: true },
  };
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(SuscripcionApertura) }),
  );
  assert.ok(html.includes('CADA MES'), 'el título por defecto de la apertura debe aparecer');
});
