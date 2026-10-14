import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NosotrosEscenas from '@/components/storefront/nosotros/NosotrosEscenas';
import NosotrosFicha from '@/components/storefront/nosotros/NosotrosFicha';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS, type SiteContentData } from './site-content-defaults';

// § ONIX-NOSOTROS-ESCENAS-FICHA-1 — las pruebas DEDICADAS de las dos secciones nuevas de /nosotros,
// aparte de `nosotros-bandas.test.ts` (que cubre el registro bandaId→render, el orden y la
// exhaustividad). Acá: una escena sin foto no se muestra; la numeración visible sigue a la posición
// ENTRE LAS VISIBLES, no al slot; la ficha se oculta bajo el piso de `tiendaCreditos`; y la ficha LEE
// `tiendaCreditos` en vez de llevar su propia copia de los créditos.
//
// SSR a texto vía `renderToStaticMarkup`, sin jsdom (el repo no lo tiene, § CLAUDE.md) — mismo motivo
// que `nosotros-bandas.test.ts`: los dos componentes son 'use client' sin import server-only (leen
// `useSiteContent()`/`useIsPreview()`, con provider/default seguros en Node).

function render(content: SiteContentData, children: React.ReactNode): string {
  return renderToStaticMarkup(React.createElement(SiteContentProvider, { value: content, children }));
}

// ─── NosotrosEscenas: hide-on-empty, y el filtro por foto ──────────────────────────────────────

test('NosotrosEscenas: con items vacíos (el default) devuelve null — hide-on-empty', () => {
  const html = render(DEFAULTS, React.createElement(NosotrosEscenas));
  assert.equal(html, '');
});

test('NosotrosEscenas: una escena SIN foto no se muestra, aunque tenga título y descripción', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosEscenas: {
      visible: true,
      variante: 'saintLaurent',
      esquineros: true,
      eyebrow: '',
      titulo: '',
      items: [
        { foto: '', titulo: 'Secado fantasma', descripcion: 'No debería aparecer.', credito1Etiqueta: '', credito1Valor: '', credito2Etiqueta: '', credito2Valor: '', pie: '' },
      ],
    },
  };
  const html = render(content, React.createElement(NosotrosEscenas));
  assert.equal(html, '', 'la sección entera se oculta: la única escena no tiene foto');
});

test('NosotrosEscenas: de dos escenas, la que SÍ tiene foto se muestra y la que no, se omite (ni su título aparece)', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosEscenas: {
      visible: true,
      variante: 'saintLaurent',
      esquineros: true,
      eyebrow: '',
      titulo: '',
      items: [
        { foto: '', titulo: 'Secado fantasma', descripcion: '', credito1Etiqueta: '', credito1Valor: '', credito2Etiqueta: '', credito2Valor: '', pie: '' },
        { foto: '/tostion.jpg', titulo: 'Tostión', descripcion: 'Lotes pequeños.', credito1Etiqueta: '', credito1Valor: '', credito2Etiqueta: '', credito2Valor: '', pie: '' },
      ],
    },
  };
  const html = render(content, React.createElement(NosotrosEscenas));
  assert.ok(html.includes('Tostión'), 'la escena con foto debe aparecer');
  assert.ok(!html.includes('Secado fantasma'), 'la escena sin foto no debe aparecer');
});

test('NosotrosEscenas: el número visible sigue a la POSICIÓN ENTRE LAS VISIBLES, no al slot original — la 2ª escena (sin foto la 1ª) muestra "01", no "02"', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosEscenas: {
      visible: true,
      variante: 'saintLaurent',
      esquineros: true,
      eyebrow: '',
      titulo: '',
      items: [
        { foto: '', titulo: 'Cosecha fantasma', descripcion: '', credito1Etiqueta: '', credito1Valor: '', credito2Etiqueta: '', credito2Valor: '', pie: '' },
        { foto: '/secado.jpg', titulo: 'Secado', descripcion: '', credito1Etiqueta: '', credito1Valor: '', credito2Etiqueta: '', credito2Valor: '', pie: '' },
      ],
    },
  };
  const html = render(content, React.createElement(NosotrosEscenas));
  assert.ok(html.includes('01'), 'la única escena visible debe numerarse "01", no "02"');
  assert.ok(!html.includes('02'), 'no debe quedar un "02" huérfano de la escena oculta');
});

test('NosotrosEscenas: sin descripción no se muestra ningún párrafo extra, y sin créditos completos no se muestra la fila', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosEscenas: {
      visible: true,
      variante: 'saintLaurent',
      esquineros: true,
      eyebrow: '',
      titulo: '',
      items: [
        { foto: '/cosecha.jpg', titulo: 'Cosecha', descripcion: '', credito1Etiqueta: 'Cuándo', credito1Valor: '', credito2Etiqueta: '', credito2Valor: '', pie: '' },
      ],
    },
  };
  const html = render(content, React.createElement(NosotrosEscenas));
  assert.ok(html.includes('Cosecha'));
  assert.ok(!html.includes('Cuándo'), 'una fila de crédito a medias (sólo etiqueta) no debe mostrarse');
});

test('NosotrosEscenas: con toggle `visible:false` devuelve null aunque haya escenas con foto', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosEscenas: {
      visible: false,
      variante: 'saintLaurent',
      esquineros: true,
      eyebrow: '',
      titulo: '',
      items: [{ foto: '/cosecha.jpg', titulo: 'Cosecha', descripcion: '', credito1Etiqueta: '', credito1Valor: '', credito2Etiqueta: '', credito2Valor: '', pie: '' }],
    },
  };
  const html = render(content, React.createElement(NosotrosEscenas));
  assert.equal(html, '');
});

// ─── NosotrosFicha: el PISO de tiendaCreditos, y la lectura directa de esa sección ──────────────

test('NosotrosFicha: con tiendaCreditos VACÍO (el default de Nayoli) devuelve null — el piso de 3 filas no se alcanza', () => {
  const html = render(DEFAULTS, React.createElement(NosotrosFicha));
  assert.equal(html, '');
});

test('NosotrosFicha: con tiendaCreditos bajo el piso (2 filas completas) sigue oculta, aunque nosotrosFicha tenga sus tres cifras llenas', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosFicha: {
      visible: true,
      eyebrow: 'La finca en cifras',
      cifra1Numero: '1.600', cifra1Rotulo: 'msnm',
      cifra2Numero: '12', cifra2Rotulo: 'hectáreas',
      cifra3Numero: '52', cifra3Rotulo: 'años',
      variante: 'tinta',
      sello: '',
      titulo: '',
      bajada: '',
      tituloTarjeta: '',
      notaPie: '',
    },
    tiendaCreditos: {
      visible: true,
      items: [
        { etiqueta: 'Finca', valor: 'San Adolfo' },
        { etiqueta: 'Municipio', valor: 'San Adolfo, Huila' },
      ],
    },
  };
  const html = render(content, React.createElement(NosotrosFicha));
  assert.equal(html, '', 'dos filas completas no alcanzan el piso de 3 de creditosVisibles()');
});

test('NosotrosFicha: con `visible:false` en nosotrosFicha, oculta aunque tiendaCreditos SÍ llegue al piso', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosFicha: { ...DEFAULTS.nosotrosFicha, visible: false },
    tiendaCreditos: {
      visible: true,
      items: [
        { etiqueta: 'Finca', valor: 'San Adolfo' },
        { etiqueta: 'Municipio', valor: 'San Adolfo, Huila' },
        { etiqueta: 'Altitud', valor: '1.500 – 1.800 msnm' },
      ],
    },
  };
  const html = render(content, React.createElement(NosotrosFicha));
  assert.equal(html, '', 'el toggle apagado gana, aunque el piso de créditos se cumpla');
});

test('NosotrosFicha: con tiendaCreditos en el piso (3 filas completas), SÍ renderiza — y LEE los valores de tiendaCreditos, no una copia propia', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosFicha: {
      visible: true,
      eyebrow: 'La finca en cifras',
      cifra1Numero: '1.600', cifra1Rotulo: 'msnm',
      cifra2Numero: '12', cifra2Rotulo: 'hectáreas',
      cifra3Numero: '52', cifra3Rotulo: 'años',
      variante: 'tinta',
      sello: '',
      titulo: '',
      bajada: '',
      tituloTarjeta: '',
      notaPie: '',
    },
    tiendaCreditos: {
      visible: true,
      items: [
        { etiqueta: 'Finca', valor: 'San Adolfo' },
        { etiqueta: 'Municipio', valor: 'San Adolfo, Huila' },
        { etiqueta: 'Altitud', valor: '1.500 – 1.800 msnm' },
      ],
    },
  };
  const html = render(content, React.createElement(NosotrosFicha));
  assert.ok(html.includes('La finca en cifras'), 'el eyebrow de la ficha debe aparecer');
  assert.ok(html.includes('1.600') && html.includes('msnm'), 'las cifras propias de la ficha deben aparecer');
  assert.ok(html.includes('San Adolfo, Huila'), 'el VALOR de tiendaCreditos debe aparecer — la ficha lo lee, no lo duplica');
  assert.ok(html.includes('1.500') , 'el tercer crédito (el que cruza el piso) debe aparecer');
});

test('NosotrosFicha: una cifra con `numero` vacío se omite (slot sobrevive al filtro), las otras dos siguen mostrándose', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosFicha: {
      visible: true,
      eyebrow: '',
      cifra1Numero: '1.600', cifra1Rotulo: 'msnm',
      cifra2Numero: '', cifra2Rotulo: 'hectáreas', // numero vacío → esta cifra se omite
      cifra3Numero: '52', cifra3Rotulo: 'años',
      variante: 'tinta',
      sello: '',
      titulo: '',
      bajada: '',
      tituloTarjeta: '',
      notaPie: '',
    },
    tiendaCreditos: {
      visible: true,
      items: [
        { etiqueta: 'Finca', valor: 'San Adolfo' },
        { etiqueta: 'Municipio', valor: 'San Adolfo, Huila' },
        { etiqueta: 'Altitud', valor: '1.500 – 1.800 msnm' },
      ],
    },
  };
  const html = render(content, React.createElement(NosotrosFicha));
  assert.ok(html.includes('1.600'));
  assert.ok(html.includes('52'));
  assert.ok(!html.includes('hectáreas'), 'el rótulo de una cifra con número vacío no debe aparecer');
});

test('NosotrosFicha: sólo cuenta filas de tiendaCreditos CON etiqueta Y valor — dos completas + una a medias siguen bajo el piso', () => {
  const content: SiteContentData = {
    ...DEFAULTS,
    nosotrosFicha: { ...DEFAULTS.nosotrosFicha, visible: true, cifra1Numero: '1.600', cifra1Rotulo: 'msnm' },
    tiendaCreditos: {
      visible: true,
      items: [
        { etiqueta: 'Finca', valor: 'San Adolfo' },
        { etiqueta: 'Municipio', valor: 'San Adolfo, Huila' },
        { etiqueta: 'Altitud', valor: '' }, // a medias: no cuenta para el piso
      ],
    },
  };
  const html = render(content, React.createElement(NosotrosFicha));
  assert.equal(html, '', 'la fila a medias no suma al piso de 3 (creditosVisibles exige etiqueta Y valor)');
});
