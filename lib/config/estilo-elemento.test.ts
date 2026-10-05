import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ELEMENTOS_ESTILO, elementosEstiloDeSeccion, metaElementoEstilo,
  TAMANOS_ELEMENTO, LABEL_TAMANO_ELEMENTO, ALINEACIONES_ELEMENTO,
  ESTILO_ELEMENTO_VACIO, resolverEstiloElemento, resolverEstilosSeccion,
  fontFamilyDeEstilo, fontSizeDeEstilo, colorCSSDeEstilo, textAlignDeEstilo, estiloInlineDeElemento,
  paresFuenteReferenciados, rolesColorLegibles, necesitaAnchoCompleto,
  type EstiloElementoResuelto,
} from './estilo-elemento';
import { derivarPaleta, RAICES_DEFECTO } from './palette-derive';
import { PARES_FUENTES } from './fuentes';
// § EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1: `MARQUEE_TITULO_FONT_SIZE` (lib/animation.ts) es el
// tamaño de HOY de la frase SIN override — el techo/piso que `ESCALA_TAMANO.ticker.grande` se
// ACERCA pero no iguala byte a byte (§ su comentario en estilo-elemento.ts: ese literal usa
// `calc()`, incompatible con el extractor de tres números que la monotonía ya comparte con las
// otras cuatro escalas). Sólo el TEST puede importar `lib/animation.ts` sin ciclo —
// `estilo-elemento.ts` no puede, ese archivo importa `site-content-defaults.ts`, que importa a
// éste—, así que el rango se afirma acá, contra el original, en vez de against un literal copiado.
import { MARQUEE_TITULO_FONT_SIZE } from '@/lib/animation';

// § EDITOR-TIENDA-BARRA-FLOTANTE-1 — capa 1, sin DOM.

// ─── (a) QUÉ ES ESTILIZABLE ─────────────────────────────────────────────────────────────────────

test('elementosEstiloDeSeccion: hero declara los CINCO elementos del spec (titular/subtítulo/leyenda/botón×2)', () => {
  assert.deepEqual(elementosEstiloDeSeccion('hero'), [
    'titulo', 'subtitulo', 'fraseAlPie', 'ctaPrimarioLabel', 'ctaSecundarioLabel',
  ]);
});

test('elementosEstiloDeSeccion: marquesina declara UN elemento ("texto", § EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1); una sección sin entrada da [] — NUNCA lanza', () => {
  assert.deepEqual(elementosEstiloDeSeccion('marquesina'), ['texto']);
  assert.deepEqual(elementosEstiloDeSeccion('nada-de-eso'), []);
});

test('metaElementoEstilo: hero.titulo es "titular"; un campo no declarado da null; marquesina.texto es "ticker" con alineación omitida', () => {
  assert.equal(metaElementoEstilo('hero', 'titulo')?.tipo, 'titular');
  assert.equal(metaElementoEstilo('hero', 'eyebrow'), null);
  assert.equal(metaElementoEstilo('marquesina', 'texto')?.tipo, 'ticker');
  assert.equal(metaElementoEstilo('marquesina', 'texto')?.sinAlinear, true, 'la frase en bucle no tiene espacio sobrante que alinear — el control se omite');
  assert.equal(metaElementoEstilo('hero', 'titulo')?.sinAlinear, undefined, 'los cinco elementos del hero siguen con alineación disponible, sin cambios');
});

test('ELEMENTOS_ESTILO: cada entrada declara un label no vacío', () => {
  for (const seccion of Object.values(ELEMENTOS_ESTILO)) {
    for (const meta of Object.values(seccion)) assert.ok(meta.label.trim().length > 0);
  }
});

// ─── (b) EL RESOLVER SOFT — nunca lanza, basura cae a null ─────────────────────────────────────

test('resolverEstiloElemento: ausente/basura/objeto vacío → ESTILO_ELEMENTO_VACIO', () => {
  assert.deepEqual(resolverEstiloElemento(undefined), ESTILO_ELEMENTO_VACIO);
  assert.deepEqual(resolverEstiloElemento(null), ESTILO_ELEMENTO_VACIO);
  assert.deepEqual(resolverEstiloElemento('una cadena'), ESTILO_ELEMENTO_VACIO);
  assert.deepEqual(resolverEstiloElemento([1, 2]), ESTILO_ELEMENTO_VACIO);
  assert.deepEqual(resolverEstiloElemento({}), ESTILO_ELEMENTO_VACIO);
});

test('resolverEstiloElemento: fuente — una clave del catálogo sobrevive; "otra-del-par" sobrevive; basura cae a null', () => {
  assert.equal(resolverEstiloElemento({ fuente: 'robusta' }).fuente, 'robusta');
  assert.equal(resolverEstiloElemento({ fuente: 'otra-del-par' }).fuente, 'otra-del-par');
  assert.equal(resolverEstiloElemento({ fuente: 'no-existe' }).fuente, null);
  assert.equal(resolverEstiloElemento({ fuente: '' }).fuente, null);
  assert.equal(resolverEstiloElemento({ fuente: 'editorial' }).fuente, 'editorial', 'editorial SÍ es una clave válida acá (a diferencia de content.tema.fuentePar, que la normaliza a null) — es un elemento pidiendo EXPLÍCITAMENTE el par de hoy, distinto de "por defecto"');
});

test('resolverEstiloElemento: tamano — un paso del set cerrado sobrevive; basura cae a null', () => {
  for (const t of TAMANOS_ELEMENTO) assert.equal(resolverEstiloElemento({ tamano: t }).tamano, t);
  assert.equal(resolverEstiloElemento({ tamano: 'gigante' }).tamano, null);
  assert.equal(resolverEstiloElemento({ tamano: '' }).tamano, null);
});

test('resolverEstiloElemento: alinear — los tres valores sobreviven; basura cae a null', () => {
  for (const a of ALINEACIONES_ELEMENTO) assert.equal(resolverEstiloElemento({ alinear: a }).alinear, a);
  assert.equal(resolverEstiloElemento({ alinear: 'justify' }).alinear, null);
});

test('resolverEstiloElemento: color — un rol del catálogo sobrevive; un hex "custom:#rrggbb" sobrevive; basura cae a null', () => {
  assert.equal(resolverEstiloElemento({ color: 'tostado' }).color, 'tostado');
  assert.equal(resolverEstiloElemento({ color: 'custom:#ff5500' }).color, 'custom:#ff5500');
  assert.equal(resolverEstiloElemento({ color: 'custom:#fff' }).color, null, 'un hex de 3 dígitos NO valida');
  assert.equal(resolverEstiloElemento({ color: '#ff5500' }).color, null, 'un hex SIN el prefijo custom: no es ni rol ni custom válido');
  assert.equal(resolverEstiloElemento({ color: 'rojo' }).color, null);
  assert.equal(resolverEstiloElemento({ color: '' }).color, null, '"Quitar" manda "" — se trata como ausente');
});

test('resolverEstilosSeccion: devuelve una entrada por CADA clave declarada, nunca undefined', () => {
  const out = resolverEstilosSeccion({ titulo: { tamano: 'enorme' } }, ['titulo', 'subtitulo']);
  assert.deepEqual(out.titulo, { ...ESTILO_ELEMENTO_VACIO, tamano: 'enorme' });
  assert.deepEqual(out.subtitulo, ESTILO_ELEMENTO_VACIO);
});

test('resolverEstilosSeccion: una clave NO declarada en el guardado se ignora — nunca se cuela', () => {
  const out = resolverEstilosSeccion({ titulo: { color: 'acento' }, intruso: { color: 'tinta' } }, ['titulo']);
  assert.deepEqual(Object.keys(out), ['titulo']);
});

test('resolverEstilosSeccion: stored ausente/basura → todas las claves vacías, NUNCA lanza', () => {
  assert.deepEqual(resolverEstilosSeccion(undefined, ['titulo']), { titulo: ESTILO_ELEMENTO_VACIO });
  assert.deepEqual(resolverEstilosSeccion('basura', ['titulo']), { titulo: ESTILO_ELEMENTO_VACIO });
});

// ─── (c) LOS TRADUCTORES A CSS — LA GARANTÍA DE BYTE-IDENTIDAD ──────────────────────────────────

test('estiloInlineDeElemento: con ESTILO_ELEMENTO_VACIO da {} — ninguna clave de `style` — byte-idéntico', () => {
  assert.deepEqual(estiloInlineDeElemento(ESTILO_ELEMENTO_VACIO, 'titular', null), {});
  assert.deepEqual(estiloInlineDeElemento(ESTILO_ELEMENTO_VACIO, 'boton', 'robusta'), {});
});

test('fontFamilyDeEstilo: fuente null → undefined (no toca la clase de siempre)', () => {
  assert.equal(fontFamilyDeEstilo(ESTILO_ELEMENTO_VACIO, 'titular', null), undefined);
});

test('fontFamilyDeEstilo: "Por defecto" en un rol DISTINTO del activo — un botón (cuerpo) con fuente null usa el CUERPO del par activo', () => {
  const editorial = PARES_FUENTES.find((p) => p.clave === 'editorial')!;
  const robusta = PARES_FUENTES.find((p) => p.clave === 'robusta')!;
  assert.equal(fontFamilyDeEstilo({ ...ESTILO_ELEMENTO_VACIO }, 'boton', null), undefined, 'null sigue sin override — sólo el VALOR declarado emite algo');
  // Declarar EXPLÍCITAMENTE el par activo ('editorial') en un titular debe dar su DISPLAY.
  assert.equal(fontFamilyDeEstilo({ ...ESTILO_ELEMENTO_VACIO, fuente: 'editorial' }, 'titular', null), editorial.titulo);
  // Y en un botón (cuerpo), el CUERPO del mismo par.
  assert.equal(fontFamilyDeEstilo({ ...ESTILO_ELEMENTO_VACIO, fuente: 'editorial' }, 'boton', null), editorial.cuerpo);
  // Una clave de OTRO par resuelve a la fuente de ESE par, para el rol del elemento.
  assert.equal(fontFamilyDeEstilo({ ...ESTILO_ELEMENTO_VACIO, fuente: 'robusta' }, 'titular', 'editorial'), robusta.titulo);
});

test('fontFamilyDeEstilo: "otra-del-par" — un titular recibe el CUERPO del par activo, y viceversa', () => {
  const editorial = PARES_FUENTES.find((p) => p.clave === 'editorial')!;
  const robusta = PARES_FUENTES.find((p) => p.clave === 'robusta')!;
  assert.equal(
    fontFamilyDeEstilo({ ...ESTILO_ELEMENTO_VACIO, fuente: 'otra-del-par' }, 'titular', null),
    editorial.cuerpo,
    'sin fuenteParActivo (null) cae al default Editorial',
  );
  assert.equal(
    fontFamilyDeEstilo({ ...ESTILO_ELEMENTO_VACIO, fuente: 'otra-del-par' }, 'boton', 'robusta'),
    robusta.titulo,
    'un botón (cuerpo) con "otra-del-par" recibe el TITULO del par activo',
  );
});

test('fontSizeDeEstilo: tamano null → undefined; cada tamano da el clamp declarado', () => {
  assert.equal(fontSizeDeEstilo(ESTILO_ELEMENTO_VACIO, 'titular'), undefined);
  assert.match(fontSizeDeEstilo({ ...ESTILO_ELEMENTO_VACIO, tamano: 'enorme' }, 'titular')!, /^clamp\(/);
});

test('ESCALA_TAMANO (vía fontSizeDeEstilo): monótona creciente, por tipo — pequeno < mediano < … < enorme en los TRES números del clamp', () => {
  const numeros = (clamp: string) => clamp.match(/-?[\d.]+/g)!.map(Number);
  for (const tipo of ['titular', 'subtitulo', 'leyenda', 'boton', 'ticker'] as const) {
    let anterior = [-Infinity, -Infinity, -Infinity];
    for (const t of TAMANOS_ELEMENTO) {
      const actual = numeros(fontSizeDeEstilo({ ...ESTILO_ELEMENTO_VACIO, tamano: t }, tipo)!);
      assert.ok(actual.every((n, i) => n >= anterior[i]), `${tipo}.${t} no es ≥ que el paso anterior`);
      anterior = actual;
    }
  }
});

test('ESCALA_TAMANO.ticker: el piso y el techo del rango (pequeno…enorme) encierran a MARQUEE_TITULO_FONT_SIZE (lib/animation.ts, el tamaño de HOY sin override) — la escala no puede "Por defecto"-achicar la frase', () => {
  const numeros = (clamp: string) => clamp.match(/-?[\d.]+/g)!.map(Number);
  const [pisoHoy, , techoHoy] = numeros(MARQUEE_TITULO_FONT_SIZE); // clamp(piso, calc(...), techo)
  const [pisoPequeno] = numeros(fontSizeDeEstilo({ ...ESTILO_ELEMENTO_VACIO, tamano: 'pequeno' }, 'ticker')!);
  const [, , techoEnorme] = numeros(fontSizeDeEstilo({ ...ESTILO_ELEMENTO_VACIO, tamano: 'enorme' }, 'ticker')!);
  assert.ok(pisoPequeno <= pisoHoy, 'ni "Pequeño" debe partir por encima del piso de hoy');
  assert.ok(techoEnorme >= techoHoy, 'ni "Enorme" debe quedar por debajo del techo de hoy');
});

test('LABEL_TAMANO_ELEMENTO: los cinco pasos tienen nombre en palabras, no un id técnico', () => {
  assert.deepEqual(LABEL_TAMANO_ELEMENTO, {
    pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande', 'muy-grande': 'Muy grande', enorme: 'Enorme',
  });
});

test('colorCSSDeEstilo: null → undefined; un rol da var(--sf-<token>); un custom da el hex crudo, SIN el prefijo', () => {
  assert.equal(colorCSSDeEstilo(ESTILO_ELEMENTO_VACIO), undefined);
  assert.equal(colorCSSDeEstilo({ ...ESTILO_ELEMENTO_VACIO, color: 'acento' }), 'var(--sf-acento)');
  assert.equal(colorCSSDeEstilo({ ...ESTILO_ELEMENTO_VACIO, color: 'suave' }), 'var(--sf-texto-suave)', 'el rol público "suave" lee la variable --sf-texto-suave');
  assert.equal(colorCSSDeEstilo({ ...ESTILO_ELEMENTO_VACIO, color: 'custom:#ff5500' }), '#ff5500');
});

test('textAlignDeEstilo: null → undefined; los tres valores traducen a left/center/right', () => {
  assert.equal(textAlignDeEstilo(ESTILO_ELEMENTO_VACIO), undefined);
  assert.equal(textAlignDeEstilo({ ...ESTILO_ELEMENTO_VACIO, alinear: 'izquierda' }), 'left');
  assert.equal(textAlignDeEstilo({ ...ESTILO_ELEMENTO_VACIO, alinear: 'centro' }), 'center');
  assert.equal(textAlignDeEstilo({ ...ESTILO_ELEMENTO_VACIO, alinear: 'derecha' }), 'right');
});

test('estiloInlineDeElemento: con los cuatro ejes declarados, da las CUATRO claves — nunca una quinta', () => {
  const estilo: EstiloElementoResuelto = { fuente: 'robusta', tamano: 'grande', color: 'tostado', alinear: 'centro' };
  const out = estiloInlineDeElemento(estilo, 'titular', 'editorial');
  assert.deepEqual(Object.keys(out).sort(), ['color', 'fontFamily', 'fontSize', 'textAlign']);
});

// § EDITOR-ARREGLOS-TITULAR-DESTACADO-1 — bug 1 (el titular se alinea a medias).

test('necesitaAnchoCompleto: sin alinear (ESTILO_ELEMENTO_VACIO) → false — byte-idéntico, nada que ensanchar', () => {
  assert.equal(necesitaAnchoCompleto(ESTILO_ELEMENTO_VACIO), false);
});

test('necesitaAnchoCompleto: los TRES valores de alinear → true, aunque sea "izquierda" (ensanchar no mueve nada ahí, pero tampoco rompe)', () => {
  assert.equal(necesitaAnchoCompleto({ ...ESTILO_ELEMENTO_VACIO, alinear: 'izquierda' }), true);
  assert.equal(necesitaAnchoCompleto({ ...ESTILO_ELEMENTO_VACIO, alinear: 'centro' }), true);
  assert.equal(necesitaAnchoCompleto({ ...ESTILO_ELEMENTO_VACIO, alinear: 'derecha' }), true);
});

test('necesitaAnchoCompleto: otros ejes (fuente/tamano/color) sin alinear → false — el gate es SÓLO la alineación', () => {
  assert.equal(necesitaAnchoCompleto({ fuente: 'robusta', tamano: 'grande', color: 'tostado', alinear: null }), false);
});

// ─── LOS <link> DE FUENTE REFERENCIADA ──────────────────────────────────────────────────────────

test('paresFuenteReferenciados: junta las claves de fuente CUSTOM, sin duplicados, ignora null y "otra-del-par"', () => {
  const estilos: Record<string, EstiloElementoResuelto> = {
    titulo: { ...ESTILO_ELEMENTO_VACIO, fuente: 'robusta' },
    subtitulo: { ...ESTILO_ELEMENTO_VACIO, fuente: 'otra-del-par' },
    fraseAlPie: { ...ESTILO_ELEMENTO_VACIO, fuente: null },
    ctaPrimarioLabel: { ...ESTILO_ELEMENTO_VACIO, fuente: 'robusta' },
    ctaSecundarioLabel: { ...ESTILO_ELEMENTO_VACIO, fuente: 'nitido' },
  };
  assert.deepEqual(paresFuenteReferenciados(estilos), ['robusta', 'nitido']);
});

test('paresFuenteReferenciados: sin ningún override de fuente → [] — no se agrega ningún <link> de más', () => {
  assert.deepEqual(paresFuenteReferenciados({ titulo: ESTILO_ELEMENTO_VACIO }), []);
});

// ─── EL FILTRO DE LEGIBILIDAD ────────────────────────────────────────────────────────────────────

test('rolesColorLegibles: contra Nayoli (acento marrón oscuro), una zona OSCURA (tinta) excluye tinta/acento; una CLARA (fondo) los incluye', () => {
  const derivado = derivarPaleta(RAICES_DEFECTO);
  const oscura = rolesColorLegibles(derivado, true);
  const clara = rolesColorLegibles(derivado, false);
  assert.ok(!oscura.includes('tinta'), 'tinta (casi negra) no se lee sobre sí misma (fondo=tinta)');
  assert.ok(clara.includes('tinta'), 'tinta SÍ se lee sobre el fondo claro de Nayoli');
  assert.ok(oscura.includes('fondo'), 'fondo (claro) se lee sobre una zona oscura');
  assert.ok(!clara.includes('fondo'), 'fondo no se lee sobre sí mismo');
});

test('rolesColorLegibles: nunca devuelve una clave fuera del catálogo de SEIS', () => {
  const derivado = derivarPaleta(RAICES_DEFECTO);
  const SEIS = new Set(['acento', 'tinta', 'suave', 'fondo', 'superficie', 'tostado']);
  for (const r of [...rolesColorLegibles(derivado, true), ...rolesColorLegibles(derivado, false)]) {
    assert.ok(SEIS.has(r));
  }
});
