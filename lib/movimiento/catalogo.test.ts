import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGO_MOVIMIENTO, CLAVES_ANIMACION, MOVIMIENTO_NINGUNA,
  movimientoPorId, esMovimientoId, motorDisponible,
} from './catalogo';

test('CATALOGO_MOVIMIENTO: 19 entradas, cada id del prototipo presente UNA sola vez', () => {
  const ids = CATALOGO_MOVIMIENTO.map((d) => d.id);
  assert.equal(ids.length, 19);
  assert.equal(new Set(ids).size, ids.length, 'ningún id se repite');
  const esperados = [
    'T01', 'T02', 'T03', 'T04', 'T05', 'T06',
    'I01', 'I02', 'I03',
    'C01', 'C02', 'N01',
    'S01', 'S02', 'S03',
    'H01', 'H02', 'H03',
    'CTA01',
  ];
  assert.deepEqual(new Set(ids), new Set(esperados));
});

test('CATALOGO_MOVIMIENTO: cada entrada declara nivel/aplicaA/descripción no vacíos', () => {
  for (const d of CATALOGO_MOVIMIENTO) {
    assert.ok(['esencial', 'editorial', 'firma'].includes(d.nivel), `${d.id}: nivel inválido`);
    assert.ok(['texto', 'imagen', 'tarjetas', 'cifras', 'seccion', 'hero'].includes(d.aplicaA), `${d.id}: aplicaA inválido`);
    assert.ok(d.nombre.trim().length > 0, `${d.id}: nombre vacío`);
    assert.ok(d.descripcion.trim().length > 0, `${d.id}: descripcion vacía`);
    for (const c of d.clases) assert.ok(['ticker', 'scrub', 'revelado'].includes(c), `${d.id}: clase inválida "${c}"`);
  }
});

test('CATALOGO_MOVIMIENTO: las ONCE esenciales listadas por el spec están implementada:true', () => {
  const esenciales = ['T01', 'T02', 'T03', 'T04', 'T05', 'I01', 'I02', 'I03', 'C01', 'C02', 'N01'];
  for (const id of esenciales) {
    assert.equal(movimientoPorId(id)?.implementada, true, `${id} debe estar implementada`);
  }
  // El resto del catálogo (narrativa de secciones/héroes/cierre) NO tiene motor en este slice.
  const sinMotor = ['T06', 'S01', 'S02', 'S03', 'H01', 'H02', 'H03', 'CTA01'];
  for (const id of sinMotor) {
    assert.equal(movimientoPorId(id)?.implementada, false, `${id} no debe estar implementada todavía`);
  }
});

test('movimientoPorId: undefined para basura, string vacío y ids desconocidos', () => {
  assert.equal(movimientoPorId(''), undefined);
  assert.equal(movimientoPorId('no-existe'), undefined);
  assert.equal(movimientoPorId('t01'), undefined, 'los ids son sensibles a mayúsculas, como el prototipo');
});

test('esMovimientoId: acepta «Ninguna» (vacío) y cada id real; rechaza basura', () => {
  assert.equal(esMovimientoId(MOVIMIENTO_NINGUNA), true);
  for (const d of CATALOGO_MOVIMIENTO) assert.equal(esMovimientoId(d.id), true, d.id);
  assert.equal(esMovimientoId('no-existe'), false);
  assert.equal(esMovimientoId(123), false);
  assert.equal(esMovimientoId(null), false);
  assert.equal(esMovimientoId(undefined), false);
});

test('CLAVES_ANIMACION: «Ninguna» + cada id del catálogo, sin duplicados', () => {
  assert.equal(CLAVES_ANIMACION[0], MOVIMIENTO_NINGUNA);
  assert.equal(CLAVES_ANIMACION.length, CATALOGO_MOVIMIENTO.length + 1);
  assert.equal(new Set(CLAVES_ANIMACION).size, CLAVES_ANIMACION.length);
});

test('motorDisponible: true sólo para un id implementado; false para «Ninguna», basura, y un id reservado sin motor', () => {
  assert.equal(motorDisponible('T01'), true);
  assert.equal(motorDisponible(MOVIMIENTO_NINGUNA), false);
  assert.equal(motorDisponible('no-existe'), false);
  assert.equal(motorDisponible('T06'), false, 'está en el catálogo pero sin motor todavía');
});
