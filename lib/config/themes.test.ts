import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLIEGO, CORTE, PATIO, VETA, VITRINA, ARRANQUE, PRESETS,
  validarPreset, presetCompleto, temasCompletos, mergePresetEnContent,
  type PresetTema, type FaltanteTema,
} from './themes';

// EL PRESET DE THEME COMO DATO (§ programa THEMES, pieza 0(d)). Puro; capa 1. Afirma:
//  1) la guarda DISTINGUE completo de incompleto y NOMBRA qué falta, por regla — con casos SINTÉTICOS,
//     nunca fotografiando cuántos/cuáles de los cinco themes del diseño validan completo hoy (ese
//     número AVANZA con cada variante que se construye, y no es una propiedad del código a afirmar);
//  2) ARRANQUE (sólo capacidades reales) valida completo SIEMPRE — es una garantía de DISEÑO, no un
//     estado de avance; el catálogo real puede sumarle compañía (CORTE ya lo hizo, ver abajo) sin que
//     esta garantía deje de sostenerse;
//  3) el merge quirúrgico preserva todo texto/imagen del dueño, tocando sólo tema/esquemas/orden/
//     variantesBandas/variante;
//  4) aplicar el mismo preset dos veces es idempotente.
//
// LOS TESTS DE PRESET NOMBRAN QUÉ FALTA, NUNCA CUÁNTO (TEMAS-PRESET-DATO-CIERRE-1). Un conteo escrito
// a mano de faltantes de `variante` es una SEGUNDA DECLARACIÓN del mismo conjunto que el REGISTRY ya
// produce: cuando una sección gana su slot (pasó con `brandStory`, TEMAS-P2-BRANDSTORY-1, ya en main),
// el NÚMERO de faltantes cambia sin que el CÓDIGO de este archivo tenga ningún defecto — y un
// `assert.equal(…, 5)` rompe igual que si lo tuviera. Por eso cada assert de abajo nombra el CONJUNTO
// de secciones que fallan (ordenado, comparado con `deepEqual`), derivado del propio `detalle` — una
// lista que no existe no puede divergir.
//
// Y NI SIQUIERA EL CONJUNTO NOMBRADO SE FOTOGRAFÍA ENTERO (TEMAS-TESTS-SIN-FOTO-1). Integrar TRES
// variantes nuevas de golpe (hero·media, featured·grilla, subscriptionCTA·linea) rompió CUATRO tests
// que enumeraban «hoy fallan exactamente estas secciones» — no por un defecto de `themes.ts` (que este
// slice NO toca), sino porque el conjunto nombrado es OTRA foto, sólo que más fina que un conteo. La
// clase es la misma que ya cerró TEMAS-PRESET-DATO-CIERRE-1 (una lista mantenida a mano que el mundo
// mueve sola) y la misma que el schema editable STRIPPEA-lo-no-declarado / CATEGORIAS≠CATEGORIA_LABELS
// (DECISIONS.md): dos declaraciones del mismo conjunto divergen apenas una de las dos deja de tocarse
// a mano. Donde una sección PASÓ a validar completo (CORTE) o donde una ÚNICA variante dejó de fallar
// dentro de un preset que sigue incompleto (PATIO, VITRINA), el test ya NO reafirma el conjunto
// restante completo — sólo el hecho MONÓTONO (una vez válida, una clave nunca vuelve a ser inválida
// sin que `themes.ts` cambie) de que esa variante puntual dejó de fallar, más un booleano de
// completitud. Un booleano y un `.includes()` no dejan de romperse jamás — pero SÓLO se rompen en el
// hito real (un preset completa del todo), no en cada paso intermedio de construcción de otra sección.
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

test('ARRANQUE valida completo SIEMPRE, y la guarda DISTINGUE completo de incompleto (con datos sintéticos, no con el catálogo real)', () => {
  // ARRANQUE es la única garantía ESTABLE del catálogo: se construye sólo con capacidades que YA
  // existen (§ su docstring), así que validar completo hoy es una propiedad de DISEÑO, no un estado de
  // avance. El resto del catálogo (PLIEGO/CORTE/PATIO/VETA/VITRINA) AVANZA a medida que sus variantes
  // se construyen —CORTE ya completó, integrando hero·media + featured·grilla sobre lo que ya tenía
  // (brandStory·columnas, presentaciones·mosaico, subscriptionCTA·linea)— así que «cuántos/cuáles
  // valen completo hoy» NO se afirma acá: es la foto que TEMAS-TESTS-SIN-FOTO-1 existe para dejar de
  // escribir. Cada preset real tiene su propio test más abajo, con la afirmación que SÍ es estable.
  assert.ok(presetCompleto(ARRANQUE), 'ARRANQUE debería validar completo');
  assert.ok(temasCompletos(PRESETS).some((p) => p.clave === 'ARRANQUE'));

  // Que la guarda REALMENTE distinga (no que siempre devuelva `true`) se prueba con un preset
  // SINTÉTICO construido a propósito — nunca con el catálogo real, que es justo lo que avanza solo.
  const incompleto: PresetTema = {
    ...ARRANQUE,
    clave: 'SINTETICO-INCOMPLETO',
    variantes: { ...ARRANQUE.variantes, hero: 'una-clave-que-no-existe' },
  };
  assert.ok(!presetCompleto(incompleto));
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
  // `brandStory` ganó su slot (TEMAS-P2-BRANDSTORY-1), `featured` ganó el suyo
  // (TEMAS-P1-FEATURED-VARIANTES-1, `VARIANTES_ESTRUCTURALES` — el gemelo del REGISTRY para bandas
  // ESTRUCTURALES sin sección) y `subscriptionCTA` ganó el suyo (TEMAS-SUBSCRIPTIONCTA-LINEA-1):
  // ninguno de los tres sirve ya para este caso — hoy `brandStory·hilo`, `featured·tabla` y
  // `subscriptionCTA·ticket` son "clave inexistente", no "sin slot". `testimonials` es el caso vivo
  // que queda: SÍ es `SeccionKey` pero no declara `variantes` en absoluto, así que ninguna de las
  // DOS tablas (REGISTRY / VARIANTES_ESTRUCTURALES) tiene entrada para nombrarle variantes. Ningún
  // preset del catálogo pide una variante de `testimonials`, así que se ejerce con un preset
  // SINTÉTICO (como los de featured, abajo).
  const sintetico: PresetTema = {
    ...ARRANQUE,
    clave: 'SINTETICO-TESTIMONIALS-SIN-SLOT',
    variantes: { ...ARRANQUE.variantes, testimonials: 'lo-que-sea' },
  };
  const faltantesSintetico = validarPreset(sintetico);
  const testimonials = faltantesSintetico.find((f) => f.detalle.includes('testimonials·lo-que-sea'));
  assert.ok(testimonials, JSON.stringify(faltantesSintetico));
  assert.ok(testimonials!.detalle.includes('no declara variantes'));
  assert.ok(!testimonials!.detalle.includes('esa clave no existe'));

  const faltantes = validarPreset(PLIEGO);

  // subscriptionCTA·ticket, ahora que la sección SÍ tiene slot (TEMAS-SUBSCRIPTIONCTA-LINEA-1) —
  // se nombra distinto, aunque `ticket` no sea ninguna de las dos claves reales (`bloque`/`linea`).
  const subscriptionCTA = faltantes.find((f) => f.detalle.includes('subscriptionCTA·ticket'));
  assert.ok(subscriptionCTA, JSON.stringify(faltantes));
  assert.ok(subscriptionCTA!.detalle.includes('esa clave no existe'));
  assert.ok(!subscriptionCTA!.detalle.includes('no declara variantes'));

  // featured·tabla, en cambio, SÍ tiene slot hoy (VARIANTES_ESTRUCTURALES.featured declara
  // `cuadricula`) — se nombra distinto, aunque `tabla` no sea esa clave.
  const featured = faltantes.find((f) => f.detalle.includes('featured·tabla'));
  assert.ok(featured, JSON.stringify(faltantes));
  assert.ok(featured!.detalle.includes('esa clave no existe'));
  assert.ok(!featured!.detalle.includes('no declara variantes'));

  // hero·marquesina, igual: SÍ tiene slot (hero declara `curtina`/`ficha`) — se nombra distinto.
  const hero = faltantes.find((f) => f.detalle.includes('hero·marquesina'));
  assert.ok(hero, JSON.stringify(faltantes));
  assert.ok(hero!.detalle.includes('esa clave no existe'));
  assert.ok(!hero!.detalle.includes('no declara variantes'));
});

test('featured: la clave ESTRUCTURAL canónica ("cuadricula") SÍ pasa la validación — no genera faltante de variante', () => {
  // Preset sintético: ARRANQUE (el único completo hoy) + un pedido de featured con su canónica.
  // Nada más cambia, así que si esto sigue completo, el slot de featured es real.
  const sintetico: PresetTema = {
    ...ARRANQUE,
    clave: 'SINTETICO-FEATURED-OK',
    variantes: { ...ARRANQUE.variantes, featured: 'cuadricula' },
  };
  const faltantes = validarPreset(sintetico);
  assert.deepEqual(faltantes.filter((f) => f.regla === 'variante'), []);
  assert.ok(presetCompleto(sintetico));
});

test('featured: una clave ESTRUCTURAL inexistente sigue fallando, y la nombra', () => {
  const sintetico: PresetTema = {
    ...ARRANQUE,
    clave: 'SINTETICO-FEATURED-BAD',
    variantes: { ...ARRANQUE.variantes, featured: 'una-que-no-existe' },
  };
  const faltantes = validarPreset(sintetico).filter((f) => f.regla === 'variante');
  assert.equal(faltantes.length, 1, JSON.stringify(faltantes));
  assert.ok(faltantes[0].detalle.includes('featured·una-que-no-existe'));
  assert.ok(faltantes[0].detalle.includes('esa clave no existe'));
  assert.ok(faltantes[0].detalle.includes('cuadricula')); // nombra el set cerrado real
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

test('CORTE: las 5 variantes que pide YA EXISTEN — CORTE valida COMPLETO', () => {
  // presentaciones·mosaico (la canónica) ya validaba; luego se construyeron, en orden,
  // subscriptionCTA·linea (TEMAS-SUBSCRIPTIONCTA-LINEA-1), hero·media (TEMAS-HERO-MEDIA-1),
  // featured·grilla (TEMAS-FEATURED-GRILLA-1) y brandStory·centrada (CORTE-BRANDSTORY-COLLAGE-1,
  // que reemplazó a brandStory·columnas en el preset — la canónica seguía validando, pero el
  // prototipo pide la composición centrada). Con las cinco válidas, CORTE se unió a ARRANQUE como
  // preset aplicable — y presentaciones·riel (CORTE-PRESENTACIONES-RIEL-1) reemplazó después a
  // presentaciones·mosaico en el preset por la misma razón que brandStory: la canónica seguía
  // validando, pero el prototipo pide el riel horizontal, no el grid. Se afirma por COMPLETITUD
  // DERIVADA (`[]`/`presetCompleto`), no enumerando qué dejó de fallar: una vez que un preset
  // completa, no hay lista que mantener — sólo puede seguir completo (monótono, mientras `themes.ts`
  // no pierda una variante ya construida).
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('CORTE es el ÚNICO preset del catálogo que declara origenTexto/origenAccion (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1)', () => {
  assert.equal(CORTE.origenTexto, 'tinta');
  assert.equal(CORTE.origenAccion, 'acento');
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.origenTexto, undefined, `${preset.clave} no debería declarar origenTexto`);
    assert.equal(preset.origenAccion, undefined, `${preset.clave} no debería declarar origenAccion`);
  }
});

test('mergePresetEnContent(_, CORTE): el tema resultante lleva los dos ejes declarados; los demás presets escriben null', () => {
  const conCorte = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, CORTE);
  const temaCorte = conCorte.tema as Record<string, unknown>;
  assert.equal(temaCorte.origenTexto, 'tinta');
  assert.equal(temaCorte.origenAccion, 'acento');

  for (const preset of [PLIEGO, PATIO, VETA, VITRINA, ARRANQUE]) {
    const despues = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, preset);
    const tema = despues.tema as Record<string, unknown>;
    assert.equal(tema.origenTexto, null, `${preset.clave} debe escribir origenTexto:null`);
    assert.equal(tema.origenAccion, null, `${preset.clave} debe escribir origenAccion:null`);
  }
});

test('CORTE es el ÚNICO preset del catálogo que declara escalaDisplay (§ TEMAS-ESCALA-DISPLAY-1)', () => {
  assert.equal(CORTE.escalaDisplay, 'amplia');
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.escalaDisplay, undefined, `${preset.clave} no debería declarar escalaDisplay`);
  }
});

test('mergePresetEnContent(_, CORTE): el tema resultante lleva escalaDisplay:"amplia"; los demás presets escriben null', () => {
  const conCorte = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, CORTE);
  const temaCorte = conCorte.tema as Record<string, unknown>;
  assert.equal(temaCorte.escalaDisplay, 'amplia');

  for (const preset of [PLIEGO, PATIO, VETA, VITRINA, ARRANQUE]) {
    const despues = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, preset);
    const tema = despues.tema as Record<string, unknown>;
    assert.equal(tema.escalaDisplay, null, `${preset.clave} debe escribir escalaDisplay:null`);
  }
});

test('presentaciones: la clave nueva "riel" (CORTE-PRESENTACIONES-RIEL-1) SÍ pasa la validación — no genera faltante de variante', () => {
  // Preset sintético: ARRANQUE (el único completo con datos sintéticos, § arriba) + un pedido de
  // presentaciones·riel. Nada más cambia, así que si esto sigue completo, la clave es real —
  // independiente de que CORTE, arriba, YA la ejerza contra el preset real.
  const sintetico: PresetTema = {
    ...ARRANQUE,
    clave: 'SINTETICO-PRESENTACIONES-RIEL-OK',
    variantes: { ...ARRANQUE.variantes, presentaciones: 'riel' },
  };
  const faltantes = validarPreset(sintetico);
  assert.deepEqual(faltantes.filter((f) => f.regla === 'variante'), []);
  assert.ok(presetCompleto(sintetico));
});

test('VETA: hero·curtina y presentaciones·indice SÍ existen — featured/brandStory/subscriptionCTA fallan', () => {
  const faltantes = validarPreset(VETA);
  assert.deepEqual(seccionesQueFallanVariante(VETA), ['brandStory', 'featured', 'subscriptionCTA']);
  // el mapa de esquemas de VETA se dejó VACÍO (el spec lo describía en prosa contradictoria, sin
  // pares concretos) — no debe fallar por eso: un mapa vacío no viola la regla (b).
  assert.equal(faltantes.filter((f) => f.regla === 'esquema').length, 0);
});

test('PATIO: featured·grilla YA ES válida (TEMAS-FEATURED-GRILLA-1) — PATIO sigue sin validar completo, y el orden sigue nombrando `banner` y `faq` como bandas inexistentes', () => {
  // brandStory·columnas (la canónica) ya validaba; featured·grilla se sumó con TEMAS-FEATURED-
  // GRILLA-1. NO se reafirma acá el conjunto COMPLETO de lo que aún falta (hero·collage,
  // presentaciones·chips, subscriptionCTA·ticket) — esa es la foto que TEMAS-TESTS-SIN-FOTO-1 existe
  // para dejar de escribir: se rompería de nuevo apenas UNA de esas tres gane su clave, sin que este
  // archivo tenga ningún defecto. Lo que se afirma es monótono: `featured` dejó de fallar (y no puede
  // volver a fallar sin que `themes.ts` pierda una variante ya construida) y PATIO, en conjunto,
  // sigue incompleto — un hecho que sólo cambiará el día que las tres piezas pendientes existan, y ese
  // día es a ESE preset al que le toca volverse a mirar (como acaba de pasarle a CORTE, arriba).
  const faltantes = validarPreset(PATIO);
  assert.ok(!seccionesQueFallanVariante(PATIO).includes('featured'), JSON.stringify(faltantes));
  assert.ok(!presetCompleto(PATIO));
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
  // hero·ficha, presentaciones·indice, subscriptionCTA·linea (TEMAS-SUBSCRIPTIONCTA-LINEA-1) y ahora
  // featured·grilla (TEMAS-FEATURED-GRILLA-1) SÍ existen hoy. NO se reafirma el conjunto completo de
  // lo que aún falta (hoy, sólo brandStory·hilo) — es la foto que TEMAS-TESTS-SIN-FOTO-1 existe para
  // dejar de escribir: se rompería de nuevo apenas `brandStory` gane una segunda variante. Lo que se
  // afirma es monótono: `featured` dejó de fallar y VITRINA, en conjunto, sigue sin validar completo.
  assert.ok(!seccionesQueFallanVariante(VITRINA).includes('featured'), JSON.stringify(faltantes));
  assert.ok(!presetCompleto(VITRINA));
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

// ── bandasVisibles (§ MUESTRARIO-BANDA-APAGABLE-1) — la capacidad GENERAL de encender/apagar bandas,
// reemplazo de los dos booleanos dedicados `bandaOrigenVisible`/`bandaMarquesinaVisible` ────────────

test('(3a) un preset con `bandasVisibles` escribe `visible` de esas bandas y preserva el resto de cada sección', () => {
  const sintetico: PresetTema = {
    ...ARRANQUE,
    clave: 'SINTETICO-BANDAS-VISIBLES',
    bandasVisibles: { origen: true, trustBadges: false },
  };
  const antes = {
    ...CONTENT_CON_DATOS_DEL_DUEÑO,
    origen: { visible: false, titulo: 'Mi origen', dato1Valor: '2.000 msnm' },
    trustBadges: { visible: true },
  };
  const despues = mergePresetEnContent(antes as unknown as Record<string, unknown>, sintetico);
  const origen = despues.origen as Record<string, unknown>;
  const trustBadges = despues.trustBadges as Record<string, unknown>;
  assert.equal(origen.visible, true);
  assert.equal(origen.titulo, 'Mi origen', 'preserva el resto de la sección, no sólo escribe visible');
  assert.equal(origen.dato1Valor, '2.000 msnm');
  assert.equal(trustBadges.visible, false);
});

test('(3b) un preset SIN `bandasVisibles` no toca ningún `visible` — cada preset del catálogo que no lo declara queda byte-idéntico', () => {
  const antes = { ...CONTENT_CON_DATOS_DEL_DUEÑO, origen: { visible: false }, trustBadges: { visible: true } };
  let ejercido = 0;
  for (const preset of PRESETS) {
    if (preset.bandasVisibles) continue; // hoy sólo CORTE lo declara
    ejercido += 1;
    const despues = mergePresetEnContent(antes as unknown as Record<string, unknown>, preset);
    assert.deepEqual(despues.origen, antes.origen, `${preset.clave} no debería tocar origen`);
    assert.deepEqual(despues.trustBadges, antes.trustBadges, `${preset.clave} no debería tocar trustBadges`);
  }
  // PLIEGO/PATIO/VETA/VITRINA/ARRANQUE — los cinco que no son CORTE.
  assert.equal(ejercido, 5, 'el preset que declara bandasVisibles no debería ser más que uno hoy (CORTE)');
});

test('(3c) validarPreset rechaza una banda desconocida en `bandasVisibles`, por nombre — GEMELA de la regla (b) de esquemas', () => {
  const sintetico: PresetTema = {
    ...ARRANQUE,
    clave: 'SINTETICO-BANDA-DESCONOCIDA',
    bandasVisibles: { banner: true } as unknown as PresetTema['bandasVisibles'],
  };
  const faltantes = validarPreset(sintetico);
  const bandaVisible = faltantes.filter((f) => f.regla === 'bandaVisible');
  assert.equal(bandaVisible.length, 1, JSON.stringify(faltantes));
  assert.ok(bandaVisible[0].detalle.includes('`banner`, que no existe en BANDA_IDS'));
});

test('(3d) CORTE resuelve la secuencia del prototipo y deja apagadas trustBadges/testimonials, encendidas origen/marquesina', () => {
  // Secuencia MEDIDA contra docs/prototipos/cafeone/index.html (§ CENSO-MUESTRARIO-1, el comentario
  // de `orden` en themes.ts): hero → marquee → spotlight(featured) → presentaciones → historia
  // (brandStory) → origen → cta-strip(subscriptionCTA). Sin trustBadges/testimonials en el prototipo.
  assert.deepEqual(
    CORTE.orden,
    ['hero', 'marquesina', 'featured', 'presentaciones', 'brandStory', 'origen', 'subscriptionCTA'],
  );
  assert.deepEqual(CORTE.bandasVisibles, { origen: true, marquesina: true, trustBadges: false, testimonials: false });
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));

  const despues = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, CORTE);
  const trustBadges = despues.trustBadges as Record<string, unknown>;
  const testimonials = despues.testimonials as Record<string, unknown>;
  const origen = despues.origen as Record<string, unknown>;
  const marquesina = despues.marquesina as Record<string, unknown>;
  assert.equal(trustBadges.visible, false);
  assert.equal(testimonials.visible, false);
  assert.equal(origen.visible, true);
  assert.equal(marquesina.visible, true);
  // El `orden` escrito es el propio de CORTE, tal cual (7 bandas) — `resolverOrden` (fuera de
  // `mergePresetEnContent`, en el resolver de lectura) es quien reinserta trustBadges/testimonials
  // al final; su posición ahí no importa porque `bandasVisibles` las mantiene apagadas.
  assert.deepEqual(despues.orden, CORTE.orden);
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
  // ARRANQUE SÍ tiene dónde pedir brandStory (declara `variantes`, § TEMAS-P2-BRANDSTORY-1) pero no
  // le pide nada — su objeto entero debe ser el MISMO.
  assert.deepEqual(despues.brandStory, antes.brandStory);
});

test('el merge quirúrgico REEMPLAZA tema/esquemas/orden/variantesBandas enteros (son composición, no contenido)', () => {
  const antes = CONTENT_CON_DATOS_DEL_DUEÑO;
  const despues = mergePresetEnContent(antes, ARRANQUE);
  assert.deepEqual(despues.tema, {
    fondo: ARRANQUE.raices.fondo,
    tinta: ARRANQUE.raices.tinta,
    acento: ARRANQUE.raices.acento,
    fuentePar: null, // resolverFuentePar('editorial') → normaliza la canónica a null
    forma: null,     // resolverForma('suave') → ídem
    // ARRANQUE no declara los dos ejes de § TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1 → null (el
    // default, byte-idéntico).
    origenTexto: null,
    origenAccion: null,
    // ARRANQUE tampoco declara escalaDisplay (§ TEMAS-ESCALA-DISPLAY-1) → null, misma familia.
    escalaDisplay: null,
  });
  assert.deepEqual(despues.esquemas, { featured: 'crema', subscriptionCTA: 'acento' });
  assert.deepEqual(despues.orden, ARRANQUE.orden);
  // ARRANQUE no pide ninguna banda ESTRUCTURAL (no menciona `featured` en `variantes`) → vacío.
  assert.deepEqual(despues.variantesBandas, {});
});

test('el merge quirúrgico manda una banda ESTRUCTURAL (`featured`) a `variantesBandas`, NUNCA a una clave huérfana `content.featured`', () => {
  // PLIEGO pide featured·tabla (inválido hoy, pero mergePresetEnContent NO valida — § su docstring).
  // Antes de este slice, esto habría creado `despues.featured = { variante: 'tabla' }`: una clave
  // que ningún loader ni componente lee (FeaturedProducts.tsx no tiene dispatcher, § VARIANTES_
  // ESTRUCTURALES). Ahora va al mapa, como `esquemas`.
  const despues = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, PLIEGO);
  assert.equal(despues.featured, undefined, 'no debe crear una clave huérfana `content.featured`');
  assert.deepEqual(despues.variantesBandas, { featured: 'tabla' });
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

// ── LA FUSIÓN DE TRES VÍAS (§ REAPPLY-PRESERVA-OVERRIDES-1) — re-aplicar un preset deja de pisar lo
// que el dueño ya ajustó. La matriz de abajo usa CORTE (el único preset que declara `cromo`/`menu`
// junto con el resto de los ejes) para poder ejercer el caso REAL sobre un campo de verdad —
// `cromo.navTinta` (el interruptor del Encabezado) y `menu.badgeTexto` (el texto del badge) —, no un
// preset sintético que no tocaría esos campos en absoluto. ────────────────────────────────────────

test('(a) SIN snapshot: el preset escribe todo lo que declara, byte a byte lo de HOY — y el snapshot NACE poblado', () => {
  // CONTENT_CON_DATOS_DEL_DUEÑO no trae `presetSnapshot` — el caso "primer apply", o una fila de
  // antes de esta capacidad. Ya lo cubren los tests de arriba (preserva texto/imagen, reemplaza
  // tema/esquemas/orden/variantesBandas); acá se afirma además que el snapshot queda poblado tras el
  // primer apply, listo para la PRÓXIMA fusión.
  const despues = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, CORTE);
  const cromo = despues.cromo as Record<string, unknown>;
  assert.equal(cromo.navTinta, true, 'lo que CORTE declara, sin ningún override');
  const snapshot = despues.presetSnapshot as Record<string, unknown>;
  assert.equal(snapshot['cromo.navTinta'], true);
  assert.equal(snapshot['menu.badgeTexto'], 'Cosecha 2026');
});

test('(b) CON snapshot y el valor ACTUAL coincide con lo que el snapshot recuerda: se escribe lo NUEVO del preset — la mejora se propaga', () => {
  const primerApply = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, CORTE);
  // Simula una MEJORA al preset: CORTE pasa a declarar navTinta:false. El dueño nunca tocó el campo
  // (el valor actual sigue siendo el que CORTE declaró la vez pasada, `true`, igual al snapshot), así
  // que el campo debe SEGUIR al preset mejorado, no quedarse en `true`.
  const corteMejorado: PresetTema = { ...CORTE, navTinta: false };
  const segundoApply = mergePresetEnContent(primerApply, corteMejorado);
  const cromo = segundoApply.cromo as Record<string, unknown>;
  assert.equal(cromo.navTinta, false, 'sin override del dueño, la mejora del preset se propaga');
});

test('(c) CON snapshot y el valor ACTUAL difiere del snapshot: el dueño lo cambió, y se PRESERVA', () => {
  const primerApply = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, CORTE);
  // El dueño apaga el interruptor desde el panel (`EncabezadoSeccion.tsx` escribe `content.cromo`
  // directo, fuera de este motor) — simulado acá tocando el content resultante a mano.
  const conAjusteDelDueño = {
    ...primerApply,
    cromo: { ...(primerApply.cromo as Record<string, unknown>), navTinta: false },
  };
  const reaplicado = mergePresetEnContent(conAjusteDelDueño, CORTE); // el MISMO preset, sin cambios
  const cromo = reaplicado.cromo as Record<string, unknown>;
  assert.equal(cromo.navTinta, false, 'el ajuste del dueño sobrevive a re-aplicar el mismo preset');
});

test('(d) el snapshot queda SIEMPRE actualizado a lo que el preset declara AHORA — incluso cuando se preserva el valor del dueño', () => {
  const primerApply = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, CORTE);
  const conAjusteDelDueño = {
    ...primerApply,
    cromo: { ...(primerApply.cromo as Record<string, unknown>), navTinta: false },
  };
  const reaplicado = mergePresetEnContent(conAjusteDelDueño, CORTE);
  const snapshot = reaplicado.presetSnapshot as Record<string, unknown>;
  // El snapshot NO guarda el valor PRESERVADO (false, el del dueño): guarda lo que CORTE declara
  // ahora (true) — es la base de comparación de la PRÓXIMA vez, no un historial de lo escrito.
  assert.equal(snapshot['cromo.navTinta'], true);
  const cromo = reaplicado.cromo as Record<string, unknown>;
  assert.equal(cromo.navTinta, false, 'pero lo ESCRITO en este apply sigue siendo el valor preservado del dueño');
});

test('(e) EL CASO REAL: el dueño apaga cromo.navTinta y edita menu.badgeTexto; tras DOS re-aplicaciones de CORTE, los DOS ajustes siguen ahí', () => {
  const primerApply = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, CORTE);
  const conAjustesDelDueño = {
    ...primerApply,
    cromo: { ...(primerApply.cromo as Record<string, unknown>), navTinta: false },
    menu: { ...(primerApply.menu as Record<string, unknown>), badgeTexto: 'Cosecha 2025' },
  };
  let content: Record<string, unknown> = conAjustesDelDueño;
  for (let i = 0; i < 2; i += 1) content = mergePresetEnContent(content, CORTE);
  const cromo = content.cromo as Record<string, unknown>;
  const menu = content.menu as Record<string, unknown>;
  assert.equal(cromo.navTinta, false, 'el interruptor del Encabezado sigue apagado tras re-aplicar CORTE');
  assert.equal(menu.badgeTexto, 'Cosecha 2025', 'el texto del badge del menú sigue siendo el del dueño');
  // Lo que el dueño NO tocó se sigue actualizando con lo que CORTE declara — la fusión es por CAMPO,
  // no "todo o nada" sobre `cromo`/`menu` enteros.
  assert.equal(cromo.navSubtitulo, true);
  assert.equal(menu.badgeItem, 'tienda');
});

test('esquemas/orden/variantesBandas se fusionan como BLOB ENTERO: una mejora al preset se propaga entera si el dueño nunca los tocó', () => {
  const primerApply = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, CORTE);
  const corteMejorado: PresetTema = { ...CORTE, esquemas: { ...CORTE.esquemas, featured: 'oscuro' } };
  const segundoApply = mergePresetEnContent(primerApply, corteMejorado);
  assert.deepEqual(segundoApply.esquemas, corteMejorado.esquemas);
});

test('esquemas: si el valor ACTUAL del blob difiere del snapshot (otro preset aplicado encima), se PRESERVA el blob completo', () => {
  const primerApply = mergePresetEnContent(CONTENT_CON_DATOS_DEL_DUEÑO, CORTE);
  const conOtroEsquema = { ...primerApply, esquemas: { featured: 'oscuro' } }; // divergió del snapshot de CORTE
  const reaplicado = mergePresetEnContent(conOtroEsquema, CORTE);
  assert.deepEqual(reaplicado.esquemas, { featured: 'oscuro' });
});
