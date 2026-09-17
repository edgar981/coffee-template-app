import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  numeroTarjetaValido, parseVencimiento, vencimientoVigente, codigoSeguridadValido, nombreTitularValido,
  detectarRedTarjeta,
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

// ── detectarRedTarjeta ────────────────────────────────────────────────────────

test('sin ningún dígito, todavía no se sabe', () => {
  assert.deepEqual(detectarRedTarjeta(''), { estado: 'desconocido' });
});

test('Visa se reconoce con el primer dígito (siempre empieza en 4)', () => {
  assert.deepEqual(detectarRedTarjeta('4'), { estado: 'reconocida', red: 'visa' });
  assert.deepEqual(detectarRedTarjeta('4242 4242 4242 4242'), { estado: 'reconocida', red: 'visa' });
});

test('Mastercard, rango clásico 51–55', () => {
  assert.deepEqual(detectarRedTarjeta('55'), { estado: 'reconocida', red: 'mastercard' });
  assert.deepEqual(detectarRedTarjeta('5555555555554444'), { estado: 'reconocida', red: 'mastercard' });
});

test('Mastercard, rango nuevo 2221–2720 (necesita los 4 dígitos para decidir)', () => {
  assert.deepEqual(detectarRedTarjeta('222'), { estado: 'desconocido' }); // podría ser 2221–2229
  assert.deepEqual(detectarRedTarjeta('2223'), { estado: 'reconocida', red: 'mastercard' });
  assert.deepEqual(detectarRedTarjeta('2223000048400011'), { estado: 'reconocida', red: 'mastercard' });
});

test('American Express, 34 o 37', () => {
  assert.deepEqual(detectarRedTarjeta('34'), { estado: 'reconocida', red: 'amex' });
  assert.deepEqual(detectarRedTarjeta('378282246310005'), { estado: 'reconocida', red: 'amex' });
});

test('Diners Club, 36, 38–39 o 300–305/309', () => {
  assert.deepEqual(detectarRedTarjeta('36'), { estado: 'reconocida', red: 'diners' });
  assert.deepEqual(detectarRedTarjeta('38520000023237'), { estado: 'reconocida', red: 'diners' });
  assert.deepEqual(detectarRedTarjeta('300000000000004'), { estado: 'reconocida', red: 'diners' });
  assert.deepEqual(detectarRedTarjeta('309'), { estado: 'reconocida', red: 'diners' });
});

test('pocos dígitos ambiguos entre Amex y Diners (los dos empiezan con 3): todavía no se sabe', () => {
  assert.deepEqual(detectarRedTarjeta('3'), { estado: 'desconocido' });
  // "30" todavía podría ser Diners (300–305 o 309) — falta el tercer dígito.
  assert.deepEqual(detectarRedTarjeta('30'), { estado: 'desconocido' });
});

test('un prefijo que ninguna red conocida puede completar: no reconocida, sin adivinar', () => {
  assert.deepEqual(detectarRedTarjeta('6011000000000004'), { estado: 'no_reconocida' }); // Discover, fuera de alcance
  assert.deepEqual(detectarRedTarjeta('306'), { estado: 'no_reconocida' }); // 300–305 y 309 ya lo descartan
  assert.deepEqual(detectarRedTarjeta('9999'), { estado: 'no_reconocida' });
});

test('espacios de agrupación se ignoran igual que en numeroTarjetaValido', () => {
  assert.deepEqual(detectarRedTarjeta('  42 42'), { estado: 'reconocida', red: 'visa' });
});
