import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  numeroTarjetaValido, parseVencimiento, vencimientoVigente, codigoSeguridadValido, nombreTitularValido,
} from './tarjeta';

// ── numeroTarjetaValido (Luhn) ──────────────────────────────────────────────

test('un número con dígito verificador correcto es válido', () => {
  assert.equal(numeroTarjetaValido('4242424242424242'), true);
});

test('el mismo número con espacios de agrupación sigue siendo válido', () => {
  assert.equal(numeroTarjetaValido('4242 4242 4242 4242'), true);
});

test('alterar el último dígito rompe el checksum → inválido', () => {
  assert.equal(numeroTarjetaValido('4242424242424243'), false);
});

test('menos de 13 dígitos es inválido, aunque el checksum diera bien', () => {
  assert.equal(numeroTarjetaValido('42424242'), false);
});

test('más de 19 dígitos es inválido', () => {
  assert.equal(numeroTarjetaValido('42424242424242424242'), false);
});

test('caracteres no numéricos son inválidos', () => {
  assert.equal(numeroTarjetaValido('4242-4242-4242-4242'), false);
  assert.equal(numeroTarjetaValido('424242424242424a'), false);
});

test('cadena vacía es inválida', () => {
  assert.equal(numeroTarjetaValido(''), false);
});

// ── parseVencimiento ─────────────────────────────────────────────────────────

test('MM/AA de 2 dígitos se interpreta como 20AA', () => {
  assert.deepEqual(parseVencimiento('12/26'), { mes: 12, anio: 2026 });
});

test('MM/AAAA de 4 dígitos se toma tal cual', () => {
  assert.deepEqual(parseVencimiento('01/2027'), { mes: 1, anio: 2027 });
});

test('espacios sueltos alrededor de la barra y del valor se toleran', () => {
  assert.deepEqual(parseVencimiento('  9 / 26  '), { mes: 9, anio: 2026 });
});

test('mes fuera de 1–12 es null', () => {
  assert.equal(parseVencimiento('13/26'), null);
  assert.equal(parseVencimiento('00/26'), null);
});

test('forma irreconocible es null, no una excepción', () => {
  assert.equal(parseVencimiento('2026-12'), null);
  assert.equal(parseVencimiento(''), null);
  assert.equal(parseVencimiento('diciembre'), null);
  assert.equal(parseVencimiento('12/1'), null); // año de 1 dígito no matchea
});

// ── vencimientoVigente ───────────────────────────────────────────────────────

const HOY = new Date(2026, 8, 16); // 2026-09-16, mes 0-indexado → septiembre

test('el mes en curso todavía está vigente (vence al cierre del mes)', () => {
  assert.equal(vencimientoVigente({ mes: 9, anio: 2026 }, HOY), true);
});

test('un mes ya pasado del año en curso no está vigente', () => {
  assert.equal(vencimientoVigente({ mes: 8, anio: 2026 }, HOY), false);
});

test('un año futuro está vigente sin importar el mes', () => {
  assert.equal(vencimientoVigente({ mes: 1, anio: 2027 }, HOY), true);
});

test('un año ya pasado no está vigente sin importar el mes', () => {
  assert.equal(vencimientoVigente({ mes: 12, anio: 2025 }, HOY), false);
});

// ── codigoSeguridadValido ─────────────────────────────────────────────────────

test('3 dígitos (Visa/Mastercard) es válido', () => {
  assert.equal(codigoSeguridadValido('123'), true);
});

test('4 dígitos (Amex) es válido', () => {
  assert.equal(codigoSeguridadValido('1234'), true);
});

test('2 o 5 dígitos son inválidos', () => {
  assert.equal(codigoSeguridadValido('12'), false);
  assert.equal(codigoSeguridadValido('12345'), false);
});

test('caracteres no numéricos son inválidos', () => {
  assert.equal(codigoSeguridadValido('12a'), false);
});

test('espacios envolventes se toleran', () => {
  assert.equal(codigoSeguridadValido(' 123 '), true);
});

// ── nombreTitularValido ────────────────────────────────────────────────────

test('un nombre con al menos 2 caracteres (tras trim) es válido', () => {
  assert.equal(nombreTitularValido('Ana Ruiz'), true);
});

test('vacío o sólo espacios es inválido', () => {
  assert.equal(nombreTitularValido(''), false);
  assert.equal(nombreTitularValido('   '), false);
});

test('un único carácter (tras trim) es inválido', () => {
  assert.equal(nombreTitularValido(' J '), false);
});
