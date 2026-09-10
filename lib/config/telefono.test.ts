import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partirTelefono, componerTelefono, INDICATIVOS, INDICATIVO_DEFECTO } from './telefono';

test('el defecto es +57/CO, y NO es el único indicativo del set', () => {
  assert.equal(INDICATIVO_DEFECTO, '+57');
  assert.equal(INDICATIVOS[0].valor, '+57');
  assert.ok(INDICATIVOS.length > 1, 'el set debe traer más de un país');
});

test('round-trip: componer(partir(v)) === v, para un valor ya normalizado', () => {
  const v = '+57 315 576 6064';
  const p = partirTelefono(v);
  assert.deepEqual(p, { indicativo: '+57', numero: '315 576 6064' });
  assert.equal(componerTelefono(p.indicativo, p.numero), v);
});

test('round-trip: un valor SIN indicativo se conserva entero', () => {
  const v = '3155766064';
  const p = partirTelefono(v);
  assert.deepEqual(p, { indicativo: '', numero: '3155766064' });
  assert.equal(componerTelefono(p.indicativo, p.numero), v);
});

test('valor pegado (sin espacio): normaliza insertando UN espacio — comportamiento CONOCIDO, no accidental', () => {
  const v = '+573155766064';
  const p = partirTelefono(v);
  assert.deepEqual(p, { indicativo: '+57', numero: '3155766064' });
  // El round-trip NO reproduce el original byte a byte: inserta el espacio que faltaba.
  assert.equal(componerTelefono(p.indicativo, p.numero), '+57 3155766064');
});

test('vacío: partir da los dos campos vacíos, y componer(vacío, vacío) da vacío', () => {
  assert.deepEqual(partirTelefono(''), { indicativo: '', numero: '' });
  assert.equal(componerTelefono('', ''), '');
});

test('basura sin indicativo: se conserva como número entero, nunca se inventa un prefijo', () => {
  const p = partirTelefono('hola mundo');
  assert.deepEqual(p, { indicativo: '', numero: 'hola mundo' });
});

test('longest-match: +1 (2 chars), +57 (3 chars) y +507 (4 chars) resuelven cada uno al SUYO, no al de otro largo', () => {
  assert.equal(partirTelefono('+15551234567').indicativo, '+1');
  assert.equal(partirTelefono('+573155766064').indicativo, '+57');
  assert.equal(partirTelefono('+50761234567').indicativo, '+507');
});

test('componerTelefono omite las partes vacías', () => {
  assert.equal(componerTelefono('+57', ''), '+57');
  assert.equal(componerTelefono('', '3155766064'), '3155766064');
  assert.equal(componerTelefono('+57', '3155766064'), '+57 3155766064');
});
