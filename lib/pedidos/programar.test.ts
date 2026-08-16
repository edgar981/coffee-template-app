import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  problemaGuardarEntrega, hayCambiosProgramacion, type ProgramacionSnapshot,
} from './programar';

const base: ProgramacionSnapshot = {
  zona:           'centro',
  mensajero:      '',
  fecha:          '',
  notas:          '',
  tipoEnvio:      'LOCAL',
  transportadora: '',
  numeroGuia:     '',
};

const snap = (patch: Partial<ProgramacionSnapshot>): ProgramacionSnapshot => ({ ...base, ...patch });

// ── La dirección, primero ────────────────────────────────────────────────────

test('sin dirección, el problema es la dirección — aunque haya cambios', () => {
  const p = problemaGuardarEntrega(snap({ fecha: '2026-09-01' }), base, false);
  assert.equal(p?.campo, 'direccion');
});

// ── El caso reportado: abrir sin tocar nada ──────────────────────────────────

test('con dirección pero sin cambios, el problema es que no hay cambios', () => {
  const p = problemaGuardarEntrega({ ...base }, base, true);
  assert.equal(p?.campo, 'sin_cambios');
});

test('tocar la fecha habilita (no hay problema)', () => {
  assert.equal(problemaGuardarEntrega(snap({ fecha: '2026-09-01' }), base, true), null);
});

test('tocar el mensajero habilita', () => {
  assert.equal(problemaGuardarEntrega(snap({ mensajero: 'Andrés' }), base, true), null);
});

test('cambiar a NACIONAL y poner guía habilita', () => {
  const inicial = base;
  const actual = snap({ tipoEnvio: 'NACIONAL', transportadora: 'Servientrega', numeroGuia: '123' });
  assert.equal(problemaGuardarEntrega(actual, inicial, true), null);
});

// ── El cálculo de "sucio" que la guarda de descarte reusa ────────────────────

test('hayCambiosProgramacion: snapshot igual = sin cambios', () => {
  assert.equal(hayCambiosProgramacion({ ...base }, base), false);
});

test('hayCambiosProgramacion: una nota distinta = hay cambios', () => {
  assert.equal(hayCambiosProgramacion(snap({ notas: 'Dejar en portería' }), base), true);
});

// Si el snapshot inicial YA traía datos (una entrega ya programada que se abre a
// editar), volver a ese mismo estado no es un cambio.
test('volver al estado inicial ya programado no es un cambio', () => {
  const yaProgramada = snap({ mensajero: 'Andrés', fecha: '2026-09-01', zona: 'norte' });
  assert.equal(hayCambiosProgramacion({ ...yaProgramada }, yaProgramada), false);
  assert.equal(problemaGuardarEntrega({ ...yaProgramada }, yaProgramada, true)?.campo, 'sin_cambios');
});
