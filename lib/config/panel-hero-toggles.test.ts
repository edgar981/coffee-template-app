import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SECCIONES_TIENDA, gatePorCampo, campoAtenuado } from '@/components/admin/tienda-secciones';
import { camposControladosPorPanel, huecosDelPanel, PENDIENTE_PANEL } from './panel-controles';

// PANEL-EDITOR-HERO-TOGGLES-1: los cinco interruptores del hero (`ctasVisibles`, `cueDesliza`,
// `titularVisible`, `subtituloVisible`, `alturaLlena`) pasan de "sólo el preset los escribe" a
// CONTROLES del panel, con el valor del preset como default. Y el PATRÓN GENERAL que este slice
// establece —un campo cuyo gate está apagado se muestra ATENUADO, nunca escondido ni
// editable-sin-nota— vive como dos funciones PURAS (`gatePorCampo`/`campoAtenuado`,
// `components/admin/tienda-secciones.ts`) para que los siete editores siguientes (§ CLAUDE.md,
// § Backlog de PENDIENTE_PANEL) lo reusen sin reinventar el mecanismo.
//
// EN MEMORIA: no monta React (el repo no tiene jsdom, § CLAUDE.md "El glob NO incluye *.test.tsx").
// Prueba el CONFIG (`HERO.booleanos`) y las dos funciones puras que `TiendaSeccionEditor` consume
// para decidir el render — no el JSX en sí. El componente lo cubre el gate visual (owner).

const HERO = SECCIONES_TIENDA.find((c) => c.seccion === 'hero')!;

// ─── LOS CINCO TOGGLES SON CONTROLES AHORA ──────────────────────────────────────────────────────────

test('HERO.booleanos declara exactamente los cinco interruptores, con esos nombres', () => {
  const nombres = (HERO.booleanos ?? []).map((b) => b.name).sort();
  assert.deepEqual(nombres, ['alturaLlena', 'ctasVisibles', 'cueDesliza', 'subtituloVisible', 'titularVisible']);
});

test('los cinco campos hero.* quedan CONTROLADOS por el panel (vía config.booleanos)', () => {
  const controlados = new Set(camposControladosPorPanel());
  for (const campo of ['hero.ctasVisibles', 'hero.cueDesliza', 'hero.titularVisible', 'hero.subtituloVisible', 'hero.alturaLlena']) {
    assert.ok(controlados.has(campo), `${campo} debería estar controlado`);
  }
});

test('los cinco YA NO están en PENDIENTE_PANEL — la lista encogió, el grupo se cerró', () => {
  const exentos = new Set(PENDIENTE_PANEL.map((e) => e.campo));
  for (const campo of ['hero.ctasVisibles', 'hero.cueDesliza', 'hero.titularVisible', 'hero.subtituloVisible', 'hero.alturaLlena']) {
    assert.ok(!exentos.has(campo), `${campo} seguía exento — el grupo hero-toggles no se cerró`);
  }
  assert.ok(!PENDIENTE_PANEL.some((e) => e.cierra === 'PANEL-EDITOR-HERO-TOGGLES-1'), 'ninguna entrada de PENDIENTE_PANEL debe citar ya PANEL-EDITOR-HERO-TOGGLES-1');
});

// ─── EL GATE SIGUE VERDE — el chequeo real, sin exenciones huérfanas ni control fantasma ───────────

test('huecosDelPanel(): sigue en [] — remover la exención y agregar el control no rompió el guard', () => {
  assert.deepEqual(huecosDelPanel(), []);
});

// ─── EL PATRÓN GENERAL DE ATENUACIÓN — reusable, item 1 del spec ───────────────────────────────────

test('gatePorCampo(HERO): titulo/tituloEnfasis → titularVisible; subtitulo → subtituloVisible; los dos CTA → ctasVisibles', () => {
  const gates = gatePorCampo(HERO);
  assert.equal(gates.get('titulo'), 'titularVisible');
  assert.equal(gates.get('tituloEnfasis'), 'titularVisible');
  assert.equal(gates.get('subtitulo'), 'subtituloVisible');
  assert.equal(gates.get('ctaPrimarioLabel'), 'ctasVisibles');
  assert.equal(gates.get('ctaSecundarioLabel'), 'ctasVisibles');
});

test('gatePorCampo(HERO): eyebrow no está gateado por ningún interruptor (no aparece en el mapa)', () => {
  assert.equal(gatePorCampo(HERO).has('eyebrow'), false);
});

test('cueDesliza y alturaLlena no gatean ningún campo de texto (sin gatedFields — controlan presentación, no texto)', () => {
  const nombresGate = new Set(gatePorCampo(HERO).values());
  assert.equal(nombresGate.has('cueDesliza'), false);
  assert.equal(nombresGate.has('alturaLlena'), false);
});

test('campoAtenuado: titulo se atenúa cuando titularVisible es false', () => {
  assert.equal(campoAtenuado(HERO, 'titulo', { titularVisible: false }), true);
});

test('campoAtenuado: titulo NO se atenúa cuando titularVisible es true', () => {
  assert.equal(campoAtenuado(HERO, 'titulo', { titularVisible: true }), false);
});

test('campoAtenuado: titulo NO se atenúa si el form no trae titularVisible (ausente = encendido, mismo criterio que `visible`)', () => {
  assert.equal(campoAtenuado(HERO, 'titulo', {}), false);
});

test('campoAtenuado: tituloEnfasis y titulo comparten el mismo gate — los dos se atenúan juntos (un solo bloque)', () => {
  const form = { titularVisible: false };
  assert.equal(campoAtenuado(HERO, 'titulo', form), true);
  assert.equal(campoAtenuado(HERO, 'tituloEnfasis', form), true);
});

test('campoAtenuado: subtitulo se atenúa por SU PROPIO gate, independiente de titularVisible', () => {
  const form = { titularVisible: true, subtituloVisible: false };
  assert.equal(campoAtenuado(HERO, 'titulo', form), false);
  assert.equal(campoAtenuado(HERO, 'subtitulo', form), true);
});

test('campoAtenuado: eyebrow nunca se atenúa (no está gateado) aunque todos los interruptores estén apagados', () => {
  const form = { titularVisible: false, subtituloVisible: false, ctasVisibles: false };
  assert.equal(campoAtenuado(HERO, 'eyebrow', form), false);
});

// ─── NO SE ESCONDE — el campo sigue declarado en `campos`, editable, esté o no atenuado ────────────
// LÍMITE declarado: sin jsdom no se puede afirmar que el <input> queda habilitado en el DOM; lo que
// SÍ se afirma acá es la garantía de CONFIG que hace posible que no se esconda: `titulo` sigue en
// `HERO.campos` sin condición — nada en el config lo retira cuando su gate está apagado. El resto
// (el `<input>` sin `disabled`, el estilo atenuado, la nota) es capa 3 (gate visual del owner).
test('el campo gateado sigue declarado en HERO.campos — el config nunca lo retira por el estado del gate', () => {
  const nombres = HERO.campos.map((c) => c.name);
  assert.ok(nombres.includes('titulo'));
  assert.ok(nombres.includes('subtitulo'));
  assert.ok(nombres.includes('ctaPrimarioLabel'));
  assert.ok(nombres.includes('ctaSecundarioLabel'));
});
