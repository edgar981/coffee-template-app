import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cifraContador, formatoCifraContador } from './cifra-contador';

// ─── cifraContador — sin separador, el comportamiento viejo intacto ───────────────────────────────

test('cifraContador: entero sin separador ("12", "52") → valor numérico, separador null', () => {
  assert.deepEqual(cifraContador('12'), { valor: 12, separador: null });
  assert.deepEqual(cifraContador('52'), { valor: 52, separador: null });
});

test('cifraContador: negativo sin separador sigue siendo válido (el regex viejo ya lo aceptaba)', () => {
  assert.deepEqual(cifraContador('-7'), { valor: -7, separador: null });
});

test('cifraContador: "0" es válido — un cero DECLARADO por el dato, no inventado', () => {
  assert.deepEqual(cifraContador('0'), { valor: 0, separador: null });
});

test('cifraContador: recorta espacios antes de evaluar', () => {
  assert.deepEqual(cifraContador('  52  '), { valor: 52, separador: null });
});

// ─── cifraContador — el fix: separador de miles, punto o coma ─────────────────────────────────────

test('cifraContador: "1.600" (punto, el caso real del bug) → valor 1600, separador "."', () => {
  assert.deepEqual(cifraContador('1.600'), { valor: 1600, separador: '.' });
});

test('cifraContador: "12.500" (punto) → valor 12500', () => {
  assert.deepEqual(cifraContador('12.500'), { valor: 12500, separador: '.' });
});

test('cifraContador: "1,600" (coma) → valor 1600, separador ","', () => {
  assert.deepEqual(cifraContador('1,600'), { valor: 1600, separador: ',' });
});

test('cifraContador: "1.234.567" (varios grupos de tres) → valor 1234567', () => {
  assert.deepEqual(cifraContador('1.234.567'), { valor: 1234567, separador: '.' });
});

test('cifraContador: negativo con separador — "-1.600" → valor -1600', () => {
  assert.deepEqual(cifraContador('-1.600'), { valor: -1600, separador: '.' });
});

// ─── cifraContador — lo que sigue siendo inválido, a propósito ────────────────────────────────────

test('cifraContador: "N/D" → null — no numérico, se muestra literal', () => {
  assert.equal(cifraContador('N/D'), null);
});

test('cifraContador: vacío → null', () => {
  assert.equal(cifraContador(''), null);
  assert.equal(cifraContador('   '), null);
});

test('cifraContador: "1.6" → null — Number("1.600") da 1.6, exactamente el dato que corrompería; un grupo de 1 dígito no es un separador de miles', () => {
  assert.equal(cifraContador('1.6'), null);
});

test('cifraContador: "1.60" → null — grupo de 2 dígitos, no de 3', () => {
  assert.equal(cifraContador('1.60'), null);
});

test('cifraContador: "1.600,50" → null — separadores mezclados, ningún carácter agrupa consistentemente', () => {
  assert.equal(cifraContador('1.600,50'), null);
});

test('cifraContador: "1.6000" → null — el último grupo tiene 4 dígitos, no 3', () => {
  assert.equal(cifraContador('1.6000'), null);
});

// ─── formatoCifraContador — redisplay con el MISMO separador que el dato ──────────────────────────

test('formatoCifraContador: separador "." agrupa de tres en tres con punto — "0 → 1.600"', () => {
  assert.equal(formatoCifraContador(0, '.'), '0');
  assert.equal(formatoCifraContador(800, '.'), '800');
  assert.equal(formatoCifraContador(1600, '.'), '1.600');
  assert.equal(formatoCifraContador(1234567, '.'), '1.234.567');
});

test('formatoCifraContador: separador "," agrupa con coma — NUNCA lo reemplaza por un punto', () => {
  assert.equal(formatoCifraContador(1600, ','), '1,600');
});

test('formatoCifraContador: separador null reproduce toLocaleString("es-CO") — "como hoy", sin cambio', () => {
  assert.equal(formatoCifraContador(12, null), (12).toLocaleString('es-CO'));
  assert.equal(formatoCifraContador(52, null), (52).toLocaleString('es-CO'));
});

test('formatoCifraContador: redondea un valor a medio contar (el paso intermedio del rAF)', () => {
  assert.equal(formatoCifraContador(1599.7, '.'), '1.600');
  assert.equal(formatoCifraContador(823.2, null), '823');
});

test('formatoCifraContador: negativo conserva el signo afuera del agrupado', () => {
  assert.equal(formatoCifraContador(-1600, '.'), '-1.600');
});
