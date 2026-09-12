import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLIEGO, CORTE, PATIO, VETA, VITRINA, ARRANQUE, PRESETS,
  validarPreset, presetCompleto, temasCompletos, mergePresetEnContent,
  type PresetTema, type FaltanteTema,
} from './themes';

// EL PRESET DE THEME COMO DATO (§ programa THEMES, pieza 0(d)). Puro; capa 1. Afirma:
//  1) los cinco themes del diseño son INCOMPLETOS hoy (la validación los rechaza y nombra qué falta);
//  2) el preset de ARRANQUE (sólo capacidades reales) es el ÚNICO que valida completo;
//  3) el merge quirúrgico preserva todo texto/imagen del dueño, tocando sólo tema/esquemas/orden/variante;
//  4) aplicar el mismo preset dos veces es idempotente.
//
// LOS TESTS DE PRESET NOMBRAN QUÉ FALTA, NUNCA CUÁNTO (TEMAS-PRESET-DATO-CIERRE-1). Un conteo escrito
// a mano de faltantes de `variante` es una SEGUNDA DECLARACIÓN del mismo conjunto que el REGISTRY ya
// produce: cuando una sección gana su slot (pasó con `brandStory`, TEMAS-P2-BRANDSTORY-1, ya en main),
// el NÚMERO de faltantes cambia sin que el CÓDIGO de este archivo tenga ningún defecto — y un
// `assert.equal(…, 5)` rompe igual que si lo tuviera. Por eso cada assert de abajo nombra el CONJUNTO
// de secciones que fallan (ordenado, comparado con `deepEqual`), derivado del propio `detalle` — una
// lista que no existe no puede divergir.
function seccionDeFaltanteVariante(f: FaltanteTema): string {
  assert.equal(f.regla, 'variante', `no es un faltante de variante: ${JSON.stringify(f)}`);
  const m = f.detalle.match(/pide `([^`]+)·/);
  if (!m) throw new Error(`no se pudo leer la sección pedida de: ${f.detalle}`);
  return m[1];
}
function seccionesQueFallanVariante(preset: PresetTema): string[] {
  return validarPreset(preset)
    .filter((f) => f.regla === 'variante')
    .map(seccionDeFaltanteVariante)
    .sort();
}

test('HOY ninguno de los cinco themes del diseño valida completo, y ARRANQUE sí', () => {
  for (const p of [PLIEGO, CORTE, PATIO, VETA, VITRINA]) {
    assert.ok(!presetCompleto(p), `${p.clave} debería estar incompleto`);
  }
  assert.ok(presetCompleto(ARRANQUE), 'ARRANQUE debería validar completo');
  assert.deepEqual(temasCompletos(PRESETS).map((p) => p.clave), ['ARRANQUE']);
});

test('la validación FALLA y NOMBRA la clave: una variante inexistente se rechaza por nombre', () => {
  const faltantes = validarPreset(PLIEGO);
  const variante = faltantes.filter((f) => f.regla === 'variante');
  assert.ok(variante.length > 0);
  // hero·marquesina no existe (hero sólo declara curtina|ficha) — se nombra tal cual.
  assert.ok(variante.some((f) => f.detalle.includes('hero·marquesina')), JSON.stringify(variante));
  assert.ok(variante.some((f) => f.detalle.includes('esa clave no existe')));
});

test('una variante pedida sobre una sección SIN slot se nombra distinto de una clave inexistente', () => {
  // `brandStory` ganó su slot (TEMAS-P2-BRANDSTORY-1, ya en main: `variantes: { claves: ['columnas'] }`)
  // y dejó de servir para este caso — hoy `brandStory·hilo` es "clave inexistente", no "sin slot".
  // `featured` sigue siendo el caso vivo: ni siquiera es una `SeccionKey` (es una banda ESTRUCTURAL,
  // § site-content-defaults.ts), así que el REGISTRY no tiene entrada para nombrarle variantes.
  // (`subscriptionCTA` también calificaría — SÍ es `SeccionKey` pero no declara `variantes` — pero
  // `featured` es el caso más claro.) La distinción SIGUE siendo comprobable.
  const faltantes = validarPreset(PLIEGO);
  const featured = faltantes.find((f) => f.detalle.includes('featured·tabla'));
  assert.ok(featured, JSON.stringify(faltantes));
  assert.ok(featured!.detalle.includes('no declara variantes en el REGISTRY'));
  assert.ok(!featured!.detalle.includes('esa clave no existe'));

  // hero·marquesina, en cambio, SÍ tiene slot (hero declara `curtina`/`ficha`) — se nombra distinto.
  const hero = faltantes.find((f) => f.detalle.includes('hero·marquesina'));
  assert.ok(hero, JSON.stringify(faltantes));
  assert.ok(hero!.detalle.includes('esa clave no existe'));
  assert.ok(!hero!.detalle.includes('no declara variantes en el REGISTRY'));
});

test('la validación ACEPTA lo que sí existe — el preset de ARRANQUE es el único aplicable hoy', () => {
  const faltantes = validarPreset(ARRANQUE);
  assert.deepEqual(faltantes, []);
});

test('PLIEGO: raíces y forma/par válidos, pero las 5 variantes fallan — todas, por nombre', () => {
  const faltantes = validarPreset(PLIEGO);
  assert.equal(faltantes.filter((f) => f.regla === 'fuentePar').length, 0);
  assert.equal(faltantes.filter((f) => f.regla === 'forma').length, 0);
  assert.deepEqual(
    seccionesQueFallanVariante(PLIEGO),
    ['brandStory', 'featured', 'hero', 'presentaciones', 'subscriptionCTA'],
  );
  assert.equal(faltantes.filter((f) => f.regla === 'orden').length, 0);
});

test('CORTE: presentaciones·mosaico y brandStory·columnas SON válidas (las dos canónicas) — sólo hero/featured/subscriptionCTA fallan', () => {
  // brandStory·columnas coincide con la única clave que `brandStory` acepta hoy (la canónica), así
  // que dejó de fallar apenas ganó su slot — CORTE pasó de 4 faltantes de variante a 3.
  assert.deepEqual(seccionesQueFallanVariante(CORTE), ['featured', 'hero', 'subscriptionCTA']);
});

test('VETA: hero·curtina y presentaciones·indice SÍ existen — featured/brandStory/subscriptionCTA fallan', () => {
  const faltantes = validarPreset(VETA);
  assert.deepEqual(seccionesQueFallanVariante(VETA), ['brandStory', 'featured', 'subscriptionCTA']);
  // el mapa de esquemas de VETA se dejó VACÍO (el spec lo describía en prosa contradictoria, sin
  // pares concretos) — no debe fallar por eso: un mapa vacío no viola la regla (b).
  assert.equal(faltantes.filter((f) => f.regla === 'esquema').length, 0);
});

test('PATIO: brandStory·columnas SÍ es válida (es la canónica) — hero/featured/presentaciones/subscriptionCTA fallan, Y el orden nombra `banner` y `faq` como bandas inexistentes', () => {
  // Igual que CORTE: brandStory·columnas coincide con la canónica y dejó de fallar — PATIO pasó de
  // 5 faltantes de variante a 4.
  const faltantes = validarPreset(PATIO);
  assert.deepEqual(
    seccionesQueFallanVariante(PATIO),
    ['featured', 'hero', 'presentaciones', 'subscriptionCTA'],
  );
  const orden = faltantes.filter((f) => f.regla === 'orden');
  assert.equal(orden.length, 2);
  assert.ok(orden.some((f) => f.detalle.includes('`banner`')));
  assert.ok(orden.some((f) => f.detalle.includes('`faq`')));
});

test('VITRINA: fuentePar y forma SIN DECIDIR (null) se nombran como faltantes, distintos de una clave inválida', () => {
  const faltantes = validarPreset(VITRINA);
  const fuentePar = faltantes.find((f) => f.regla === 'fuentePar');
  const forma = faltantes.find((f) => f.regla === 'forma');
  assert.ok(fuentePar, JSON.stringify(faltantes));
  assert.ok(forma, JSON.stringify(faltantes));
  assert.ok(fuentePar!.detalle.includes('no tiene un par tipográfico decidido'));
  assert.ok(forma!.detalle.includes('no tiene una forma decidida'));
  // hero·ficha y presentaciones·indice SÍ existen hoy.
  assert.deepEqual(seccionesQueFallanVariante(VITRINA), ['brandStory', 'featured', 'subscriptionCTA']);
});

test('regla (b): una banda inexistente y un esquema inexistente se nombran por separado', () => {
  // Cast al TIPO COMPLETO del objeto (no a los valores sueltos): `banner` no es un `BandaId`, así
  // que el tipo de `esquemas` lo rechazaría en author-time — a propósito, el mismo tripwire que el
  // preset real jamás necesita esquivar. Este test simula un dato CORRUPTO/ajeno al tipo, que es
  // justo lo que `validarPreset` (una función runtime) tiene que atrapar igual.
  const sintetico: PresetTema = {
    ...ARRANQUE,
    clave: 'SINTETICO',
    esquemas: { hero: 'invalido', banner: 'crema' } as unknown as PresetTema['esquemas'],
  };
  const faltantes = validarPreset(sintetico);
  const esquema = faltantes.filter((f) => f.regla === 'esquema');
  assert.equal(esquema.length, 2);
  assert.ok(esquema.some((f) => f.detalle.includes('`banner`, que no existe en BANDA_IDS')));
  assert.ok(esquema.some((f) => f.detalle.includes('hero·invalido')));
});

test('el catálogo completo (PRESETS) incluye los 5 del diseño + ARRANQUE, en ese orden', () => {
  assert.deepEqual(PRESETS.map((p) => p.clave), ['PLIEGO', 'CORTE', 'PATIO', 'VETA', 'VITRINA', 'ARRANQUE']);
});

// ── El merge quirúrgico: preserva TODO lo que no sean los cuatro ejes que toca ──────────────────

const CONTENT_CON_DATOS_DEL_DUEÑO = {
  hero: {
    visible: true,
    eyebrow: 'El eyebrow del dueño',
    titulo: 'El título que el dueño escribió',
    tituloEnfasis: 'historias',
    subtitulo: 'Un subtítulo largo que el dueño redactó a mano.',
    ctaPrimarioLabel: 'Comprar ahora',
    ctaSecundarioLabel: 'Suscribirme',
    imagen: '/images/una-foto-real-del-dueño.jpg',
    variante: 'curtina', // lo que había ANTES de aplicar el preset
  },
  brandStory: {
    visible: true,
    eyebrow: 'Nuestra Historia',
    titulo: 'Del cafetal a tu taza',
    parrafo1: 'Un párrafo real, con el relato del dueño.',
    parrafo2: 'Un segundo párrafo.',
    imagen1: '/images/foto1.jpg',
    imagen2: '/images/foto2.jpg',
    imagen3: '/images/foto3.jpg',
    imagen4: '/images/foto4.jpg',
  },
  tema: { fondo: null, tinta: null, acento: null, fuentePar: null, forma: null },
  esquemas: {},
  orden: ['hero', 'trustBadges', 'featured', 'brandStory', 'presentaciones', 'subscriptionCTA', 'testimonials'],
};

test('el merge quirúrgico PRESERVA cada campo de texto/imagen del hero, y sólo cambia `variante`', () => {
  const antes = CONTENT_CON_DATOS_DEL_DUEÑO;
  const despues = mergePresetEnContent(antes, ARRANQUE);

  const hero = despues.hero as Record<string, unknown>;
  assert.equal(hero.eyebrow, antes.hero.eyebrow);
  assert.equal(hero.titulo, antes.hero.titulo);
  assert.equal(hero.tituloEnfasis, antes.hero.tituloEnfasis);
  assert.equal(hero.subtitulo, antes.hero.subtitulo);
  assert.equal(hero.ctaPrimarioLabel, antes.hero.ctaPrimarioLabel);
  assert.equal(hero.ctaSecundarioLabel, antes.hero.ctaSecundarioLabel);
  assert.equal(hero.imagen, antes.hero.imagen);
  assert.equal(hero.visible, antes.hero.visible);
  // lo único que cambia: la variante, al valor que pide ARRANQUE.
  assert.equal(hero.variante, 'ficha');
  assert.notEqual(hero.variante, antes.hero.variante);
});

test('el merge quirúrgico NO TOCA una sección que el preset no menciona (brandStory queda byte-idéntica)', () => {
  const antes = CONTENT_CON_DATOS_DEL_DUEÑO;
  const despues = mergePresetEnContent(antes, ARRANQUE);
  // ARRANQUE no pide nada de brandStory (no tiene slot) — su objeto entero debe ser el MISMO.
  assert.deepEqual(despues.brandStory, antes.brandStory);
});

test('el merge quirúrgico REEMPLAZA tema/esquemas/orden enteros (son composición, no contenido)', () => {
  const antes = CONTENT_CON_DATOS_DEL_DUEÑO;
  const despues = mergePresetEnContent(antes, ARRANQUE);
  assert.deepEqual(despues.tema, {
    fondo: ARRANQUE.raices.fondo,
    tinta: ARRANQUE.raices.tinta,
    acento: ARRANQUE.raices.acento,
    fuentePar: null, // resolverFuentePar('editorial') → normaliza la canónica a null
    forma: null,     // resolverForma('suave') → ídem
  });
  assert.deepEqual(despues.esquemas, { featured: 'crema', subscriptionCTA: 'acento' });
  assert.deepEqual(despues.orden, ARRANQUE.orden);
});

test('la canónica de fuentePar/forma ("editorial"/"suave") se normaliza a null al escribir — como el picker', () => {
  const despues = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, ARRANQUE);
  const tema = despues.tema as Record<string, unknown>;
  // ARRANQUE pide explícitamente 'editorial'/'suave' (las canónicas) — se escriben como null,
  // exactamente como el picker del panel («editorial»/«suave» NUNCA se guardan literales).
  assert.equal(tema.fuentePar, null);
  assert.equal(tema.forma, null);
});

test('un par/forma CUSTOM (no canónico) se preserva tal cual al escribir', () => {
  const despues = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, PLIEGO);
  const tema = despues.tema as Record<string, unknown>;
  assert.equal(tema.fuentePar, 'robusta');
  assert.equal(tema.forma, 'recta');
});

test('idempotencia: aplicar el mismo preset dos veces da el mismo resultado', () => {
  const una = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, ARRANQUE);
  const dos = mergePresetEnContent(una, ARRANQUE);
  assert.deepEqual(una, dos);
});

test('idempotencia sobre un content VACÍO (sin fila previa, como un SiteContent recién nacido)', () => {
  const una = mergePresetEnContent({}, ARRANQUE);
  const dos = mergePresetEnContent(una, ARRANQUE);
  assert.deepEqual(una, dos);
  // el hero, sin nada previo, queda con SÓLO la variante — el resolver SOFT rellena el resto con
  // sus defaults al leer (§ resolverSiteContent), así que esto no pierde nada mostrable.
  assert.deepEqual(una.hero, { variante: 'ficha' });
});
