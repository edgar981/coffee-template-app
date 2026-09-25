import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  camposFaltantes,
  camposLeidosPorTienda,
  camposControladosPorPanel,
  huecosDelPanel,
  PENDIENTE_PANEL,
} from './panel-controles';

// ─── El NÚCLEO PURO — visto fallar con un campo sintético sin control ni exención ──────────────────

test('camposFaltantes: un campo controlado no aparece', () => {
  const faltantes = camposFaltantes(['a.b', 'a.c'], ['a.b'], []);
  assert.deepEqual(faltantes, ['a.c']);
});

test('camposFaltantes: un campo exento (pendiente-panel) no aparece', () => {
  const faltantes = camposFaltantes(['a.b', 'a.c'], ['a.b'], ['a.c']);
  assert.deepEqual(faltantes, []);
});

test('camposFaltantes: un campo NUEVO, ni controlado ni exento, SÍ aparece — el mecanismo del chequeo', () => {
  // Simula "nace un campo sin panel": a.d aparece en el lado leído sin haber sido agregado ni al
  // lado controlado ni a la lista de exención — así es como se ve un slice futuro que agrega una
  // sección/campo de contenido y se olvida de darle editor.
  const faltantes = camposFaltantes(['a.b', 'a.c', 'a.d'], ['a.b'], ['a.c']);
  assert.deepEqual(faltantes, ['a.d']);
});

// ─── EL GATE — con las exenciones declaradas, el chequeo real da VERDE ─────────────────────────────

test('huecosDelPanel(): con las exenciones PENDIENTE_PANEL, no queda ningún campo sin control', () => {
  const huecos = huecosDelPanel();
  assert.deepEqual(huecos, []);
});

// ─── HIGIENE de PENDIENTE_PANEL — la lista sólo puede encoger, nunca mentir ────────────────────────

test('PENDIENTE_PANEL: cada entrada nombra un campo que la tienda REALMENTE lee', () => {
  const leidos = new Set(camposLeidosPorTienda());
  const fantasmas = PENDIENTE_PANEL.filter((e) => !leidos.has(e.campo)).map((e) => e.campo);
  assert.deepEqual(fantasmas, [], 'una exención que nombra un campo inexistente es una exención rancia');
});

test('PENDIENTE_PANEL: ninguna entrada ya tiene control en el panel (si lo tuviera, sobra y hay que borrarla)', () => {
  const controlados = new Set(camposControladosPorPanel());
  const yaControlados = PENDIENTE_PANEL.filter((e) => controlados.has(e.campo)).map((e) => e.campo);
  assert.deepEqual(yaControlados, [], 'una exención de un campo YA controlado es la lista sin encoger cuando debía');
});

test('PENDIENTE_PANEL: sin duplicados', () => {
  const campos = PENDIENTE_PANEL.map((e) => e.campo);
  assert.deepEqual(campos, [...new Set(campos)]);
});

test('PENDIENTE_PANEL: toda entrada declara su razón y el slice que la cierra', () => {
  for (const e of PENDIENTE_PANEL) {
    assert.ok(e.razon.length > 0, `${e.campo} sin razón`);
    assert.ok(e.cierra.length > 0, `${e.campo} sin slice que la cierre`);
  }
});

// EL TRINQUETE (§ GUARDA-PRE-MERGE-TRINQUETE-BUILD-1, pedido del owner 2026-09-24): las tres pruebas
// de arriba atrapan una exención MAL FORMADA (rancia, ya controlada, duplicada, sin razón/cierra) —
// pero NINGUNA atrapa una exención NUEVA que esté bien formada. Un slice futuro podría agregar un
// campo de contenido SIN control y taparlo con una exención nueva, prolijamente escrita, y las tres
// pruebas de higiene seguirían en verde mientras PENDIENTE_PANEL CRECE — exactamente lo que el
// docstring de panel-controles.ts:46 prohíbe en prosa ("la lista nunca puede crecer en silencio").
// Este test es lo que hace esa prosa MECÁNICA: el TECHO es un TRINQUETE, sólo BAJA. Cuando un slice
// cierra exenciones (como hicieron PANEL-EDITOR-MARQUESINA-1, -TRUSTBADGES-VISIBLE-1, -ORIGEN-1,
// PANEL-EDITOR-SPOTLIGHT-RESTO-1 — bajándolo de 17 a 13, cerrando `spotlight.visible`/`.eyebrow`/
// `.titulo`/`.badge` —, y PANEL-DETALLES-SITIO-1 — bajándolo de 13 a 11, cerrando
// `volverArriba.visible`/`rielSocial.visible` —, cada uno bajando PENDIENTE_PANEL), baja el número de
// acá A MANO en el MISMO commit; nunca sube en silencio. El valor de hoy (11) es el largo actual
// medido (`PENDIENTE_PANEL.length`) — la aserción pasa hoy porque coincide; el día que alguien la vea
// fallar, la respuesta es cerrar el hueco con un CONTROL, no subir el techo.
test('PENDIENTE_PANEL: el TECHO es un TRINQUETE — la lista nunca crece por encima de su techo actual', () => {
  assert.ok(
    PENDIENTE_PANEL.length <= 11,
    `PENDIENTE_PANEL creció a ${PENDIENTE_PANEL.length}: cerrá el hueco con un CONTROL, no con una ` +
      `exención nueva. El techo sólo BAJA. Si de verdad hay que subirlo, subilo A MANO acá y explicá por qué.`,
  );
});

// ─── LA CALIBRACIÓN del owner (§ el spec de este slice) ────────────────────────────────────────────
// "puede un test derivar 'todo campo de contenido que la tienda LEE tiene su control en el panel' y
// fallar cuando nazca uno sin panel? ... CALIBRACIÓN: el chequeo DEBE marcar el sub-encabezado
// (cromo.navSubtitulo); si no lo marca, está mal calibrado."

// CERRADO por PANEL-EDITOR-ENCABEZADO-1: este test afirmaba que SIN exenciones el chequeo marcaba
// `cromo.navSubtitulo` como hueco — la calibración del owner que motivó su entrada en
// `PENDIENTE_PANEL` (§ PANEL-REFLEJA-TIENDA-CHEQUEO-1). Ese slice le dio control
// (`EncabezadoSeccion.tsx`), así que hoy está CONTROLADO y la aserción sería FALSA — no un defecto
// del chequeo, es el chequeo funcionando: el hueco que medía ya no existe. Misma familia que el
// CERRADO de `hero.titularVisible`/`hero.subtituloVisible` por PANEL-EDITOR-HERO-TOGGLES-1, abajo. La
// calibración GENERAL sigue viva en "marca EXACTAMENTE el conjunto de PENDIENTE_PANEL", que por
// construcción ya no incluye este campo.

// CERRADO por PANEL-EDITOR-HERO-TOGGLES-1: este test afirmaba que SIN exenciones el chequeo marcaba
// `hero.titularVisible`/`hero.subtituloVisible` como huecos — la calibración original que motivó su
// entrada en `PENDIENTE_PANEL`. Ese slice les dio control (`HERO.booleanos`, § tienda-secciones.ts),
// así que hoy están CONTROLADOS y la aserción de arriba sería FALSA — no un defecto del chequeo, es
// el chequeo funcionando: el hueco que medía ya no existe. La calibración GENERAL sigue viva y más
// fuerte en el test de abajo ("marca EXACTAMENTE el conjunto de PENDIENTE_PANEL"), que por
// construcción ya no incluye estos dos. Su reemplazo específico —que el mecanismo de atenuación
// funciona— vive en `lib/config/panel-hero-toggles.test.ts`.

// CERRADO por PANEL-EDITOR-MENU-BADGE-1: este test afirmaba que SIN exenciones el chequeo marcaba
// `menu.badgeItem`/`badgeTexto` como huecos — la calibración original que motivó su entrada en
// `PENDIENTE_PANEL`. Ese slice les dio control (`CONTROLADOS_MENU_SECCION`, § panel-controles.ts —
// el select del ítem con badge + su texto, atenuado sin ítem elegido, en `MenuSeccion.tsx`), así que
// hoy están CONTROLADOS y la aserción de arriba sería FALSA — no un defecto del chequeo, es el
// chequeo funcionando: el hueco que medía ya no existe. Misma familia que los dos CERRADO de arriba.
// La calibración GENERAL sigue viva en "marca EXACTAMENTE el conjunto de PENDIENTE_PANEL", que por
// construcción ya no incluye estos dos. Su reemplazo específico —que el control persiste de verdad—
// vive en `tests/integracion/menu-badge.test.ts`.

// CERRADO por PANEL-DETALLES-SITIO-1: este test (AJUSTADO antes por PANEL-EDITOR-ENCABEZADO-1, que
// bajó el título de "las cuatro metas de chrome" a "las DOS que siguen sin editor") afirmaba que SIN
// exenciones el chequeo marcaba `volverArriba.visible`/`rielSocial.visible` como huecos — la
// calibración que quedó viva tras cerrar `navTratamiento.activo`/`navWordmark.activo`. Este slice les
// dio control (`DetallesSitioSeccion.tsx`, § CONTROLADOS_DETALLES_SECCION arriba), así que hoy están
// CONTROLADOS y la aserción de arriba sería FALSA — no un defecto del chequeo, es el chequeo
// funcionando: el hueco que medía ya no existe. Misma familia que los CERRADO de arriba. La
// calibración GENERAL sigue viva en "marca EXACTAMENTE el conjunto de PENDIENTE_PANEL", que por
// construcción ya no incluye estos dos.
test('volverArriba.visible/rielSocial.visible: CONTROLADOS por DetallesSitioSeccion.tsx — ya no son huecos ni siquiera SIN exenciones', () => {
  const controlados = camposControladosPorPanel();
  assert.ok(controlados.includes('volverArriba.visible'));
  assert.ok(controlados.includes('rielSocial.visible'));
  const huecos = huecosDelPanel({ conExenciones: false });
  assert.ok(!huecos.includes('volverArriba.visible'));
  assert.ok(!huecos.includes('rielSocial.visible'));
});

// § MUESTRARIO-DRAWER-MOVIL-TEMA-1: `navDrawerMovil.variante` gana su control EN EL MISMO commit que
// la mete al lado "leído" — a diferencia de `volverArriba.visible`/`rielSocial.visible` (arriba,
// siguen sin editor), esta meta nace YA CONTROLADA. Confirma las DOS mitades: está en el lado
// controlado, y por eso NO aparece como hueco ni siquiera SIN exenciones.
test('navDrawerMovil.variante: CONTROLADO por EncabezadoSeccion.tsx desde su propio commit — nunca un hueco', () => {
  assert.ok(camposControladosPorPanel().includes('navDrawerMovil.variante'));
  assert.ok(!huecosDelPanel({ conExenciones: false }).includes('navDrawerMovil.variante'));
});

// CERRADO por PANEL-EDITOR-TRUSTBADGES-VISIBLE-1: este test afirmaba que SIN exenciones el chequeo
// marcaba `trustBadges.visible` como hueco — la calibración original que motivó su entrada en
// `PENDIENTE_PANEL`. Ese slice le dio control (`TRUSTBADGES` en `SECCIONES_TIENDA`, § tienda-
// secciones.ts), así que hoy está CONTROLADO y la aserción de arriba sería FALSA — no un defecto del
// chequeo, es el chequeo funcionando: el hueco que medía ya no existe. Misma familia que los CERRADO
// de arriba. La calibración GENERAL sigue viva en "marca EXACTAMENTE el conjunto de PENDIENTE_PANEL",
// que por construcción ya no incluye este campo. Su reemplazo específico —que el toggle persiste de
// verdad— vive en `tests/integracion/trustbadges.test.ts`.

test('calibración: los beneficios de los planes de suscripción SÍ están controlados (vía el bloque `lista`, no vía `campos`)', () => {
  const controlados = camposControladosPorPanel();
  assert.ok(controlados.includes('suscripcionPlanes.ben1_1'));
  assert.ok(controlados.includes('suscripcionPlanes.ben4_4'));
});

// § MUESTRARIO-SECCION-CTA-1: los seis campos del CTA opcional de sección (Presentaciones · Historia
// · el segundo de Suscripción) entraron a `campos` DE ENTRADA, con la lección de `panel-controles.ts`
// ya aplicada — no como hallazgo tardío. Ninguno necesita exención nueva en `PENDIENTE_PANEL`; el
// techo-trinquete (13) no se mueve.
test('calibración: el CTA de sección (Presentaciones/Historia/2º de Suscripción) está controlado, sin exención nueva', () => {
  const controlados = camposControladosPorPanel();
  assert.ok(controlados.includes('presentaciones.ctaLabel'));
  assert.ok(controlados.includes('presentaciones.ctaDestino'));
  assert.ok(controlados.includes('brandStory.ctaLabel'));
  assert.ok(controlados.includes('brandStory.ctaDestino'));
  assert.ok(controlados.includes('subscriptionCTA.ctaSecundarioLabel'));
  assert.ok(controlados.includes('subscriptionCTA.ctaSecundarioDestino'));
  const pendientes = new Set(PENDIENTE_PANEL.map((e) => e.campo));
  assert.ok(!pendientes.has('presentaciones.ctaLabel'));
  assert.ok(!pendientes.has('brandStory.ctaLabel'));
  assert.ok(!pendientes.has('subscriptionCTA.ctaSecundarioLabel'));
});

// § MUESTRARIO-CTA-BANNER-FOTO-1: `subscriptionCTA` ganó su ÚNICA imagen (`imagenFondo`, opcional —
// vacío = fondo sólido de hoy, sólo la variante 'linea' la lee) con control DE ENTRADA (`SUBSCRIPTION.
// imagenes` en tienda-secciones.ts), no como hallazgo tardío. El trinquete de PENDIENTE_PANEL (13) no
// se mueve.
test('calibración: subscriptionCTA.imagenFondo está controlado, sin exención nueva', () => {
  const controlados = camposControladosPorPanel();
  assert.ok(controlados.includes('subscriptionCTA.imagenFondo'));
  const pendientes = new Set(PENDIENTE_PANEL.map((e) => e.campo));
  assert.ok(!pendientes.has('subscriptionCTA.imagenFondo'));
});

test('calibración: SIN exenciones, el chequeo marca EXACTAMENTE el conjunto de PENDIENTE_PANEL (ni más ni menos)', () => {
  const huecos = huecosDelPanel({ conExenciones: false });
  const esperado = PENDIENTE_PANEL.map((e) => e.campo).sort();
  assert.deepEqual([...huecos].sort(), esperado);
});

// ─── LO ESTRUCTURAL — esquemas/orden/variantesBandas nunca entran al lado "leído" ──────────────────

test('esquemas/orden/variantesBandas no aparecen en camposLeidosPorTienda (dominio abierto, no "campos")', () => {
  const leidos = camposLeidosPorTienda();
  assert.ok(!leidos.some((c) => c.startsWith('esquemas.')));
  assert.ok(!leidos.some((c) => c.startsWith('orden.')));
  assert.ok(!leidos.some((c) => c.startsWith('variantesBandas.')));
});

// § REAPPLY-PRESERVA-OVERRIDES-1: `presetSnapshot` es la CUARTA meta de dominio abierto (contabilidad
// del motor de presets, § site-content-defaults.ts) — MISMA familia que las tres de arriba, así que
// tampoco debe entrar al lado "leído" ni obligar a ninguna exención nueva en PENDIENTE_PANEL. Si
// alguna vez apareciera acá, sería porque alguien la agregó a `METAS_CON_CAMPOS` por error — el dueño
// no la edita, ni siquiera indirectamente.
test('presetSnapshot no aparece en camposLeidosPorTienda (dominio abierto, contabilidad del motor de presets, no "campos")', () => {
  const leidos = camposLeidosPorTienda();
  assert.ok(!leidos.some((c) => c.startsWith('presetSnapshot.')));
  assert.ok(!leidos.includes('presetSnapshot'));
});

// ─── Nayoli sano: con las 15 secciones + 7 metas reales, el chequeo corre sin explotar ─────────────

test('camposLeidosPorTienda() y camposControladosPorPanel() no están vacíos (el chequeo mide algo real)', () => {
  assert.ok(camposLeidosPorTienda().length > 50);
  assert.ok(camposControladosPorPanel().length > 30);
});
