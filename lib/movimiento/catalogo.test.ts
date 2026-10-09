import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGO_MOVIMIENTO, CLAVES_ANIMACION, MOVIMIENTO_NINGUNA,
  movimientoPorId, esMovimientoId, motorDisponible,
  catalogoMovimientoDeElemento, puedeReproducirUnaVez,
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

test('CATALOGO_MOVIMIENTO: las DIECINUEVE entradas están implementada:true (§ MOVIMIENTO-NIVEL-FIRMA-1 cierra el catálogo)', () => {
  for (const d of CATALOGO_MOVIMIENTO) {
    assert.equal(d.implementada, true, `${d.id} debe estar implementada`);
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

test('motorDisponible: true para cualquier id del catálogo (§ MOVIMIENTO-NIVEL-FIRMA-1, las 19 implementadas); false para «Ninguna» y basura', () => {
  assert.equal(motorDisponible('T01'), true);
  assert.equal(motorDisponible('H01'), true);
  assert.equal(motorDisponible('CTA01'), true);
  assert.equal(motorDisponible(MOVIMIENTO_NINGUNA), false);
  assert.equal(motorDisponible('no-existe'), false);
});

// § MOVIMIENTO-EDITOR-EXPOSICION-1

test('catalogoMovimientoDeElemento: sólo las implementada:true del elemento pedido, en el orden del catálogo', () => {
  assert.deepEqual(catalogoMovimientoDeElemento('texto').map((d) => d.id), ['T01', 'T02', 'T03', 'T04', 'T05']);
  // § MOVIMIENTO-NIVEL-EDITORIAL-1 — T06 pasó de aplicaA:'texto' a aplicaA:'imagen' (§ catalogo.ts).
  assert.deepEqual(catalogoMovimientoDeElemento('imagen').map((d) => d.id), ['T06', 'I01', 'I02', 'I03']);
  assert.deepEqual(catalogoMovimientoDeElemento('tarjetas').map((d) => d.id), ['C01', 'C02']);
  assert.deepEqual(catalogoMovimientoDeElemento('cifras').map((d) => d.id), ['N01']);
  // § MOVIMIENTO-NIVEL-FIRMA-1 — CTA01 (aplicaA:'seccion') suma motor: mismo "leak" ya aceptado
  // para S02/S03 (nacen incorporadas en su tipo, nunca ofrecidas por el selector de "proceso"/
  // "cierre"; "texto" sigue siendo el único tipo que suma `'seccion'` a su propio elemento).
  assert.deepEqual(catalogoMovimientoDeElemento('seccion').map((d) => d.id), ['S01', 'S02', 'S03', 'CTA01']);
  // § MOVIMIENTO-NIVEL-FIRMA-1 — H01/H02/H03 ganan motor y pasan a ser composiciones de `hero.variante`.
  assert.deepEqual(catalogoMovimientoDeElemento('hero').map((d) => d.id), ['H01', 'H02', 'H03']);
});

test('puedeReproducirUnaVez: true para clase `revelado` (incluida junto a `scrub`, § H01/H02/H03/CTA01); false para scrub puro (I03), hover sin tween (C02), basura y «Ninguna»', () => {
  assert.equal(puedeReproducirUnaVez('T01'), true);
  assert.equal(puedeReproducirUnaVez('I01'), true);
  assert.equal(puedeReproducirUnaVez('I02'), true);
  assert.equal(puedeReproducirUnaVez('C01'), true);
  assert.equal(puedeReproducirUnaVez('N01'), true);
  assert.equal(puedeReproducirUnaVez('H01'), true);
  assert.equal(puedeReproducirUnaVez('H02'), true);
  assert.equal(puedeReproducirUnaVez('H03'), true);
  assert.equal(puedeReproducirUnaVez('CTA01'), true);
  assert.equal(puedeReproducirUnaVez('I03'), false, 'scrub continuo, sin "una vez" que reproducir');
  assert.equal(puedeReproducirUnaVez('C02'), false, 'hover sin tween de entrada, clases: []');
  assert.equal(puedeReproducirUnaVez('no-existe'), false);
  assert.equal(puedeReproducirUnaVez(MOVIMIENTO_NINGUNA), false);
});
