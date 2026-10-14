import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NosotrosFicha from '@/components/storefront/nosotros/NosotrosFicha';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS, type SiteContentData } from '@/lib/config/site-content-defaults';

// § CHAMISAS-APERTURA-ALBUM-AJUSTES-1 — las pruebas DEDICADAS de la composición «Etiqueta de
// bolsa» (variante "etiqueta" de `nosotrosFicha`), aparte de `lib/config/nosotros-escenas.test.ts`
// (que cubre la composición canónica «tinta» y el piso de `tiendaCreditos` que gatea a las DOS).
// Acá: los CUATRO campos nuevos (`titulo`/`bajada`/`tituloTarjeta`/`notaPie`) que cierran el defecto
// medido — el dueño escribía la bajada DENTRO de `sello` porque no había otro campo libre.

function render(content: SiteContentData, children: React.ReactNode): string {
  return renderToStaticMarkup(React.createElement(SiteContentProvider, { value: content, children }));
}

const TRES_CREDITOS = [
  { etiqueta: 'Finca', valor: 'San Adolfo, Huila' },
  { etiqueta: 'Altitud', valor: '1.600 – 2.000 m s.n.m.' },
  { etiqueta: 'Variedades', valor: 'Bourbon Rosado, Pacamara y Papayo' },
];

function contenidoEtiqueta(nosotrosFichaParcial: Partial<SiteContentData['nosotrosFicha']> = {}): SiteContentData {
  return {
    ...DEFAULTS,
    nosotrosFicha: {
      ...DEFAULTS.nosotrosFicha,
      visible: true,
      variante: 'etiqueta',
      ...nosotrosFichaParcial,
    },
    tiendaCreditos: { visible: true, items: TRES_CREDITOS },
  };
}

describe('NosotrosFichaEtiqueta — el ajuste 1: titulo/bajada separan el texto del sello', () => {
  test('con titulo y bajada llenos, los DOS aparecen — y NO dependen de `sello`', () => {
    const content = contenidoEtiqueta({
      titulo: 'De dónde viene cada bolsa',
      bajada: 'Los mismos datos de la etiqueta de la bolsa, en grande y con sello.',
      sello: '',
    });
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(html.includes('De dónde viene cada bolsa'));
    assert.ok(html.includes('Los mismos datos de la etiqueta de la bolsa, en grande y con sello.'));
  });

  test('el defecto medido YA NO reproduce: la bajada puede vivir en `bajada` sin pisar `sello`, y `sello` sigue siendo SU PROPIO texto', () => {
    const content = contenidoEtiqueta({
      bajada: 'Los mismos datos de la etiqueta de la bolsa, en grande y con sello.',
      sello: 'San Adolfo',
    });
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(html.includes('Los mismos datos de la etiqueta de la bolsa, en grande y con sello.'), 'la bajada debe aparecer');
    assert.ok(html.includes('San Adolfo'), 'el sello (otro campo) debe seguir apareciendo, intacto');
  });

  test('titulo/bajada vacíos (el default) → no aparece esa columna de texto, sin romper el resto', () => {
    const content = contenidoEtiqueta();
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(html.includes('San Adolfo, Huila'), 'la tarjeta (créditos) sigue mostrándose igual');
  });
});

describe('NosotrosFichaEtiqueta — el ajuste 2: tituloTarjeta y notaPie', () => {
  test('tituloTarjeta lleno aparece como encabezado de la tarjeta', () => {
    const content = contenidoEtiqueta({ tituloTarjeta: 'Café Las Chamisas · origen' });
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(html.includes('Café Las Chamisas · origen'));
  });

  test('notaPie lleno aparece bajo la retícula de créditos', () => {
    const content = contenidoEtiqueta({ notaPie: 'Café de origen · 100 % colombiano.' });
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(html.includes('Café de origen · 100 % colombiano.'));
  });

  test('ambos vacíos (el default) → NINGÚN claim fabricado aparece — § el invariante #44', () => {
    const content = contenidoEtiqueta();
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(!html.includes('100 % colombiano'));
    assert.ok(!html.includes('· origen'));
  });
});

describe('NosotrosFichaEtiqueta — el ajuste 3: el sello no se recorta contra la tarjeta', () => {
  test('la tarjeta NO lleva overflow-hidden — el sello (top negativo) necesita poder salir de su caja', () => {
    const content = contenidoEtiqueta({ sello: 'San Adolfo' });
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(!html.includes('relative overflow-hidden rounded-[24px] border-2 border-dashed'), 'la tarjeta punteada no debe tener overflow-hidden — recortaría el sello que cuelga arriba');
  });

  test('el sello sigue rotando -12° (la maqueta), no el -6° que tenía antes', () => {
    const content = contenidoEtiqueta({ sello: 'San Adolfo' });
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(html.includes('-rotate-12'));
    assert.ok(!html.includes('rotate-[-6deg]'));
  });
});

describe('NosotrosFichaEtiqueta — sigue gateada por el piso de tiendaCreditos (sin cambio de regla)', () => {
  test('con menos de 3 filas completas, toda la pieza —incluidos los campos nuevos— sigue oculta', () => {
    const content: SiteContentData = {
      ...DEFAULTS,
      nosotrosFicha: {
        ...DEFAULTS.nosotrosFicha,
        visible: true,
        variante: 'etiqueta',
        titulo: 'De dónde viene cada bolsa',
        tituloTarjeta: 'Café Las Chamisas · origen',
      },
      tiendaCreditos: { visible: true, items: TRES_CREDITOS.slice(0, 2) },
    };
    const html = render(content, React.createElement(NosotrosFicha));
    assert.equal(html, '', 'con 2 filas completas (bajo el piso de 3), ni siquiera el título nuevo debe aparecer');
  });
});
