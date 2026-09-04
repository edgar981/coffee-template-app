import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grupoDeTarjeta } from './puente-tarjetas';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';

// Capa 1 del mapeo SLOT → grupo del formulario (el puente vista→formulario, § Backlog #46). Afirma
// que el slot de una tarjeta clicada en la vista lleva a su grupo "Tarjeta N" real del descriptor —
// incluidos los slots opcionales (3-4), que llevan el sufijo "(opcional)"—.

const PRESENTACIONES = SECCIONES_TIENDA.find(s => s.seccion === 'presentaciones')!;

test('cada slot mapea a su grupo "Tarjeta N" del descriptor (fuente única, incluye el sufijo opcional)', () => {
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 1), 'Tarjeta 1');
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 2), 'Tarjeta 2');
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 3), 'Tarjeta 3 (opcional)');
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 4), 'Tarjeta 4 (opcional)');
});

test('un slot fuera de rango → null (el puente no salta a ningún grupo)', () => {
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 5), null);
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 0), null);
});

test('el grupo sale del DESCRIPTOR, no de un literal: coincide con el `grupo` del campo label del slot', () => {
  // Si alguien renombra el grupo en el descriptor, este mapeo lo sigue sin tocar el puente.
  for (const slot of [1, 2, 3, 4]) {
    const esperado = PRESENTACIONES.campos.find(c => c.name === `label${slot}`)?.grupo ?? null;
    assert.equal(grupoDeTarjeta(PRESENTACIONES, slot), esperado);
  }
});
