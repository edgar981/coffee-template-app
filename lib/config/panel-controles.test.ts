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
// cierra exenciones (como hicieron PANEL-EDITOR-MARQUESINA-1, -TRUSTBADGES-VISIBLE-1, -ORIGEN-1, y
// PANEL-EDITOR-SPOTLIGHT-RESTO-1 — bajándolo de 17 a 13, cerrando `spotlight.visible`/`.eyebrow`/
// `.titulo`/`.badge` —, cada uno bajando PENDIENTE_PANEL), baja el número de acá A MANO en el MISMO
// commit; nunca sube en silencio. El valor de hoy (13) es el largo actual medido — la aserción pasa
// hoy porque coincide; el día que alguien la vea fallar, la respuesta es cerrar el hueco con un
// CONTROL, no subir el techo.
test('PENDIENTE_PANEL: el TECHO es un TRINQUETE — la lista nunca crece por encima de su techo actual', () => {
  assert.ok(
    PENDIENTE_PANEL.length <= 13,
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

// AJUSTADO por PANEL-EDITOR-ENCABEZADO-1: el título decía "las cuatro metas de chrome" cuando eran
// `volverArriba.visible`/`rielSocial.visible`/`navTratamiento.activo`/`navWordmark.activo`. Ese
// slice le dio control a las DOS últimas (`EncabezadoSeccion.tsx`), así que hoy sólo quedan DOS sin
// controlar — la aserción sobre las otras dos sería FALSA, misma familia que el CERRADO de arriba.
test('calibración: SIN exenciones, el chequeo marca las DOS metas de chrome que siguen sin editor', () => {
  const huecos = huecosDelPanel({ conExenciones: false });
  assert.ok(huecos.includes('volverArriba.visible'));
  assert.ok(huecos.includes('rielSocial.visible'));
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

// ─── Nayoli sano: con las 15 secciones + 7 metas reales, el chequeo corre sin explotar ─────────────

test('camposLeidosPorTienda() y camposControladosPorPanel() no están vacíos (el chequeo mide algo real)', () => {
  assert.ok(camposLeidosPorTienda().length > 50);
  assert.ok(camposControladosPorPanel().length > 30);
});
