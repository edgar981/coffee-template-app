import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  numeroTarjetaValido, parseVencimiento, vencimientoVigente, codigoSeguridadValido, nombreTitularValido,
  detectarRedTarjeta, formatearNumeroTarjeta, formatearVencimientoCampo, reformatearCampoTarjeta,
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

// ── formatearNumeroTarjeta ───────────────────────────────────────────────────

test('teclear de corrido: el espacio de agrupación aparece al 5° dígito', () => {
  assert.equal(formatearNumeroTarjeta('4'), '4');
  assert.equal(formatearNumeroTarjeta('424'), '424');
  assert.equal(formatearNumeroTarjeta('4242'), '4242');
  assert.equal(formatearNumeroTarjeta('42424'), '4242 4');
  assert.equal(formatearNumeroTarjeta('4242424242424242'), '4242 4242 4242 4242');
});

test('valor incompleto: menos de 4 dígitos no lleva separador', () => {
  assert.equal(formatearNumeroTarjeta('42'), '42');
  assert.equal(formatearNumeroTarjeta(''), '');
});

test('pegar CON separadores: se descartan y se re-derivan, no se duplican', () => {
  assert.equal(formatearNumeroTarjeta('4242 4242 4242 4242'), '4242 4242 4242 4242');
  assert.equal(formatearNumeroTarjeta('4242-4242-4242-4242'), '4242 4242 4242 4242');
});

test('pegar SIN separadores: agrupa igual que si se hubiera tecleado', () => {
  assert.equal(formatearNumeroTarjeta('4242424242424242'), '4242 4242 4242 4242');
});

test('se corta a 19 dígitos, el tope real de un PAN', () => {
  assert.equal(formatearNumeroTarjeta('42424242424242424242'), '4242 4242 4242 4242 424');
});

// ── formatearVencimientoCampo ────────────────────────────────────────────────

test('teclear de corrido: la barra se inserta sola al 2° dígito', () => {
  assert.equal(formatearVencimientoCampo('1'), '1');
  assert.equal(formatearVencimientoCampo('12'), '12/');
  assert.equal(formatearVencimientoCampo('122'), '12/2');
  assert.equal(formatearVencimientoCampo('1226'), '12/26');
});

test('valor incompleto: 0 o 1 dígito no llevan barra', () => {
  assert.equal(formatearVencimientoCampo(''), '');
  assert.equal(formatearVencimientoCampo('9'), '9');
});

test('pegar CON separador: se descarta y se re-deriva la barra en el mismo lugar', () => {
  assert.equal(formatearVencimientoCampo('12/26'), '12/26');
  assert.equal(formatearVencimientoCampo('12-2027'), '12/2027');
});

test('pegar SIN separador: agrupa igual, incluido el año largo', () => {
  assert.equal(formatearVencimientoCampo('1226'), '12/26');
  assert.equal(formatearVencimientoCampo('122027'), '12/2027');
});

test('se corta a 6 dígitos (MM + AAAA), el año largo máximo que parseVencimiento acepta', () => {
  assert.equal(formatearVencimientoCampo('1220279'), '12/2027');
});

// ── reformatearCampoTarjeta (formato + cursor, las dos reglas que evitan quedar atrapado) ────

test('número — teclear de corrido: el cursor avanza al final tras cada dígito', () => {
  // El comprador ya tenía "424" con el cursor al final (posición 3) y tecleó un "2" más.
  const r = reformatearCampoTarjeta(formatearNumeroTarjeta, '4242', 4);
  assert.equal(r.valor, '4242');
  assert.equal(r.cursor, 4);

  // Un dígito más cruza el 5° dígito: aparece el espacio y el cursor queda DESPUÉS de él.
  const r2 = reformatearCampoTarjeta(formatearNumeroTarjeta, '42424', 5);
  assert.equal(r2.valor, '4242 4');
  assert.equal(r2.cursor, 6);
});

test('número — borrar hacia atrás sobre el separador: no se traba, el próximo borrado sí quita un dígito', () => {
  // Valor mostrado "4242 4242", cursor justo después del espacio (posición 5). El comprador
  // presiona Retroceso: el navegador borra el espacio y entrega "42424242" con el cursor en 4.
  const r = reformatearCampoTarjeta(formatearNumeroTarjeta, '42424242', 4);
  // El espacio se re-deriva en el mismo lugar (no se perdió ningún dígito)...
  assert.equal(r.valor, '4242 4242');
  // ...pero el cursor queda ANTES del espacio, pegado al último dígito del primer grupo — no
  // después de él. Un segundo Retroceso desde acá borra el '2', un dígito real.
  assert.equal(r.cursor, 4);
});

test('número — pegar CON separadores: cursor al final del resultado', () => {
  const pegado = '4242 4242 4242 4242';
  const r = reformatearCampoTarjeta(formatearNumeroTarjeta, pegado, pegado.length);
  assert.equal(r.valor, '4242 4242 4242 4242');
  assert.equal(r.cursor, r.valor.length);
});

test('número — pegar SIN separadores: cursor al final del resultado reagrupado', () => {
  const pegado = '4242424242424242';
  const r = reformatearCampoTarjeta(formatearNumeroTarjeta, pegado, pegado.length);
  assert.equal(r.valor, '4242 4242 4242 4242');
  assert.equal(r.cursor, r.valor.length);
});

test('número — valor incompleto: cursor sigue al final de lo tecleado', () => {
  const r = reformatearCampoTarjeta(formatearNumeroTarjeta, '424', 3);
  assert.equal(r.valor, '424');
  assert.equal(r.cursor, 3);
});

test('vencimiento — teclear de corrido: el cursor pasa la barra recién insertada', () => {
  const r = reformatearCampoTarjeta(formatearVencimientoCampo, '12', 2);
  assert.equal(r.valor, '12/');
  assert.equal(r.cursor, 2); // pegado al '2', antes de la barra — el próximo dígito cae detrás.
});

test('vencimiento — borrar hacia atrás sobre la barra: no se traba', () => {
  // Valor mostrado "12/26", cursor justo después de la barra (posición 3). Retroceso borra la
  // barra: el navegador entrega "1226" con el cursor en 2.
  const r = reformatearCampoTarjeta(formatearVencimientoCampo, '1226', 2);
  // La barra se re-deriva sola (2 dígitos siempre la llevan)...
  assert.equal(r.valor, '12/26');
  // ...pero el cursor queda ANTES de ella, no después: el próximo Retroceso borra un dígito real.
  assert.equal(r.cursor, 2);
});

test('vencimiento — pegar CON separador: cursor al final del resultado', () => {
  const pegado = '12/26';
  const r = reformatearCampoTarjeta(formatearVencimientoCampo, pegado, pegado.length);
  assert.equal(r.valor, '12/26');
  assert.equal(r.cursor, r.valor.length);
});

test('vencimiento — pegar SIN separador: cursor al final del resultado formateado', () => {
  const pegado = '1226';
  const r = reformatearCampoTarjeta(formatearVencimientoCampo, pegado, pegado.length);
  assert.equal(r.valor, '12/26');
  assert.equal(r.cursor, r.valor.length);
});

test('vencimiento — valor incompleto: un solo dígito no lleva barra ni mueve el cursor de más', () => {
  const r = reformatearCampoTarjeta(formatearVencimientoCampo, '1', 1);
  assert.equal(r.valor, '1');
  assert.equal(r.cursor, 1);
});

test('cursor en el MEDIO del valor (corregir un dígito) no salta al final', () => {
  // "4242 4242 4242 4242" con el cursor tras el 2° grupo (posición 9, después del espacio que
  // sigue al 2° "4242"). Al insertar un dígito ahí el resultado crece, pero el cursor debe
  // quedar pegado al dígito insertado, no arrastrado al final del string.
  const conDigitoInsertado = '4242 42429 4242 4242'; // el '9' recién tecleado en el medio
  const r = reformatearCampoTarjeta(formatearNumeroTarjeta, conDigitoInsertado, 10);
  assert.equal(r.valor, '4242 4242 9424 2424 2');
  assert.notEqual(r.cursor, r.valor.length);
});
