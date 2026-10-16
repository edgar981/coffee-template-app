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

  // § CHAMISAS-NOSOTROS-FIDELIDAD-1 — "sello sigue siendo SU PROPIO texto" VENCIÓ: el sello pasó
  // de píldora de texto a imagen (`LogoMark`, § el docstring de cabecera del componente), así que
  // `nosotrosFicha.sello` ya NO tiene ningún consumidor — esta prueba antes pasaba por una
  // COINCIDENCIA (el texto "San Adolfo" también aparece en `TRES_CREDITOS.Finca`, no por el sello),
  // no porque el sello renderizara. Se corrige para afirmar la realidad nueva: la bajada SIGUE
  // viviendo en `bajada` (sin pisarla), el campo `sello` queda SIN EFECTO (lo que el dueño escriba
  // ahí no aparece en ningún lado), y el sello-IMAGEN (el mark, nunca el texto) SIGUE presente.
  test('la bajada vive en `bajada` sin pisar `sello`; `sello` queda SIN EFECTO (texto ya no renderiza) y el sello-imagen (LogoMark) sigue presente', () => {
    const content = contenidoEtiqueta({
      bajada: 'Los mismos datos de la etiqueta de la bolsa, en grande y con sello.',
      sello: 'Un texto de sello que ya no debe aparecer en ningún lado',
    });
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(html.includes('Los mismos datos de la etiqueta de la bolsa, en grande y con sello.'), 'la bajada debe aparecer');
    assert.ok(!html.includes('Un texto de sello que ya no debe aparecer en ningún lado'), '`sello` ya no tiene efecto bajo esta composición');
    assert.ok(html.includes('mix-blend-multiply'), 'el sello-imagen (LogoMark) debe seguir presente, con su mezcla de color');
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

describe('NosotrosFichaEtiqueta — § CHAMISAS-NOSOTROS-ARCO-Y-FICHA-1: cada fila lleva SU PROPIO ícono', () => {
  test('el defecto medido ya no reproduce: las seis filas de Las Chamisas NO llevan todas el mismo `lucide-minus`', () => {
    const content = contenidoEtiqueta();
    const html = render(content, React.createElement(NosotrosFicha));
    const apariciones = (html.match(/lucide-minus/g) ?? []).length;
    assert.ok(apariciones < 3, `sólo las filas SIN ícono reconocido deben caer a "minus" (encontradas ${apariciones} veces, de 3 filas)`);
  });

  test('Finca → pin (lucide-map-pin), Altitud → montaña (lucide-mountain), Variedades → brote (lucide-sprout)', () => {
    const content = contenidoEtiqueta();
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(html.includes('lucide-map-pin'), 'la fila "Finca" debe llevar el ícono de pin');
    assert.ok(html.includes('lucide-mountain'), 'la fila "Altitud" debe llevar el ícono de montaña');
    assert.ok(html.includes('lucide-sprout'), 'la fila "Variedades" debe llevar el ícono de brote');
  });

  test('Proceso → gota (lucide-droplet), Cosecha → calendario (lucide-calendar), Familias → personas (lucide-users)', () => {
    const content: SiteContentData = {
      ...DEFAULTS,
      nosotrosFicha: { ...DEFAULTS.nosotrosFicha, visible: true, variante: 'etiqueta' },
      tiendaCreditos: {
        visible: true,
        items: [
          { etiqueta: 'Proceso', valor: 'Lavado' },
          { etiqueta: 'Cosecha principal', valor: 'Marzo – junio' },
          { etiqueta: 'Familias', valor: '12 familias' },
        ],
      },
    };
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(html.includes('lucide-droplet'), 'la fila "Proceso" debe llevar el ícono de gota');
    assert.ok(html.includes('lucide-calendar'), 'la fila "Cosecha principal" debe llevar el ícono de calendario');
    assert.ok(html.includes('lucide-users'), 'la fila "Familias" debe llevar el ícono de personas');
  });

  test('Tostión → grano (lucide-coffee), Presentación → bolsa (lucide-package), y una etiqueta desconocida cae a NEUTRO (lucide-minus), nunca rompe', () => {
    const content: SiteContentData = {
      ...DEFAULTS,
      nosotrosFicha: { ...DEFAULTS.nosotrosFicha, visible: true, variante: 'etiqueta' },
      tiendaCreditos: {
        visible: true,
        items: [
          { etiqueta: 'Tostión', valor: 'Media' },
          { etiqueta: 'Presentación', valor: '340 g' },
          { etiqueta: 'Un dato cualquiera', valor: 'Sin ícono reconocido' },
        ],
      },
    };
    const html = render(content, React.createElement(NosotrosFicha));
    assert.ok(html.includes('lucide-coffee'), 'la fila "Tostión" debe llevar el ícono de grano');
    assert.ok(html.includes('lucide-package'), 'la fila "Presentación" debe llevar el ícono de bolsa');
    assert.ok(html.includes('lucide-minus'), 'una etiqueta sin ícono reconocido cae al ícono neutro, no revienta');
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
