import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fichaIcono } from '@/lib/storefront/ficha-iconos';

// § CHAMISAS-NOSOTROS-ARCO-Y-FICHA-1 — el defecto medido: cada fila de la Ficha «Etiqueta de
// bolsa» pintaba el MISMO ícono (`Minus`) sin importar el dato. `fichaIcono` deriva un ícono de la
// ETIQUETA (texto libre), normalizando acentos/mayúsculas — las OCHO claves que el spec pide: pin
// (origen/finca), montaña (altitud), brote (variedades), gota (proceso), calendario (cosecha),
// personas (familias), grano (tostión), bolsa (presentación) — más el fallback neutro.

describe('fichaIcono — las ocho claves del spec, por palabra clave', () => {
  test('Finca → origen', () => {
    assert.equal(fichaIcono('Finca'), 'origen');
  });
  test('Altitud → altitud', () => {
    assert.equal(fichaIcono('Altitud'), 'altitud');
  });
  test('Variedades → variedades', () => {
    assert.equal(fichaIcono('Variedades'), 'variedades');
  });
  test('Proceso → proceso', () => {
    assert.equal(fichaIcono('Proceso'), 'proceso');
  });
  test('Cosecha principal → cosecha (substring, no igualdad exacta)', () => {
    assert.equal(fichaIcono('Cosecha principal'), 'cosecha');
  });
  test('Familias → familias', () => {
    assert.equal(fichaIcono('Familias'), 'familias');
  });
  test('Tostión → tostion (acento normalizado)', () => {
    assert.equal(fichaIcono('Tostión'), 'tostion');
  });
  test('Presentación → presentacion (acento normalizado)', () => {
    assert.equal(fichaIcono('Presentación'), 'presentacion');
  });
});

describe('fichaIcono — case/acentos no importan, y una etiqueta desconocida cae a neutro', () => {
  test('mayúsculas/minúsculas mezcladas igual matchean', () => {
    assert.equal(fichaIcono('fInCa'), 'origen');
    assert.equal(fichaIcono('ALTITUD'), 'altitud');
  });
  test('una etiqueta que ninguna regla reconoce NO revienta — cae a neutro', () => {
    assert.equal(fichaIcono('Un dato cualquiera'), 'neutro');
  });
  test('etiqueta vacía → neutro, sin lanzar', () => {
    assert.equal(fichaIcono(''), 'neutro');
    assert.equal(fichaIcono('   '), 'neutro');
  });
});
