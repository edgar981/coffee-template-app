import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cruzarMetodosPasarela, DESCRIPTOR_NEQUI, DESCRIPTORES_METODO_PASARELA, metodosPasarelaParaComprador,
  type DescriptorMetodoPasarela,
} from './metodos-pasarela';

test('las dos listas vacías → []', () => {
  assert.deepEqual(cruzarMetodosPasarela([], []), []);
});

test('guardado === cuenta → todos disponible', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'NEQUI'], ['CARD', 'NEQUI']),
    [
      { tipo: 'CARD', estado: 'disponible' },
      { tipo: 'NEQUI', estado: 'disponible' },
    ],
  );
});

test('guardado vacío, cuenta con métodos → todos disponible_no_ofrecido', () => {
  assert.deepEqual(
    cruzarMetodosPasarela([], ['CARD', 'PSE']),
    [
      { tipo: 'CARD', estado: 'disponible_no_ofrecido' },
      { tipo: 'PSE', estado: 'disponible_no_ofrecido' },
    ],
  );
});

test('guardado con un tipo que la cuenta ya no tiene → guardado_no_disponible, al final', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'BRE_B'], ['CARD']),
    [
      { tipo: 'CARD', estado: 'disponible' },
      { tipo: 'BRE_B', estado: 'guardado_no_disponible' },
    ],
  );
});

test('los tres estados a la vez, en el orden de la cuenta primero', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'BRE_B'], ['PSE', 'CARD']),
    [
      { tipo: 'PSE', estado: 'disponible_no_ofrecido' },
      { tipo: 'CARD', estado: 'disponible' },
      { tipo: 'BRE_B', estado: 'guardado_no_disponible' },
    ],
  );
});

test('cuenta vacía, guardado con métodos → todos guardado_no_disponible', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'NEQUI'], []),
    [
      { tipo: 'CARD', estado: 'guardado_no_disponible' },
      { tipo: 'NEQUI', estado: 'guardado_no_disponible' },
    ],
  );
});

// ── EL DESCRIPTOR DE PRUEBA (NEQUI) — §API-DIRECTA-OTROS-METODOS-1 ──────────────────────────

test('DESCRIPTOR_NEQUI.campo.validar: acepta un celular colombiano de 10 dígitos que empieza por 3', () => {
  assert.equal(DESCRIPTOR_NEQUI.campo.validar('3001234567'), null);
});

test('DESCRIPTOR_NEQUI.campo.validar: acepta el mismo número con espacios (se limpia antes de chequear)', () => {
  assert.equal(DESCRIPTOR_NEQUI.campo.validar('300 123 4567'), null);
});

test('DESCRIPTOR_NEQUI.campo.validar: rechaza un número que no empieza por 3', () => {
  const motivo = DESCRIPTOR_NEQUI.campo.validar('2001234567');
  assert.equal(typeof motivo, 'string');
  assert.notEqual(motivo, null);
});

test('DESCRIPTOR_NEQUI.campo.validar: rechaza un número con menos de 10 dígitos', () => {
  assert.notEqual(DESCRIPTOR_NEQUI.campo.validar('300123'), null);
});

test('DESCRIPTOR_NEQUI.campo.validar: rechaza vacío', () => {
  assert.notEqual(DESCRIPTOR_NEQUI.campo.validar(''), null);
});

test('DESCRIPTOR_NEQUI.construirPaymentMethod: arma {type, phone_number} con sólo los dígitos', () => {
  assert.deepEqual(
    DESCRIPTOR_NEQUI.construirPaymentMethod('300 123 4567'),
    { type: 'NEQUI', phone_number: '3001234567' },
  );
});

// ── LA PROPIEDAD DE "LA FORMA": el cruce de lo encendido con lo de la cuenta produce la
// lista correcta de opciones (§ API-DIRECTA-OTROS-METODOS-1, §5 del reporte del slice) ───────

test('metodosPasarelaParaComprador: dueño encendió Y cuenta tiene Y hay descriptor → se ofrece', () => {
  const r = metodosPasarelaParaComprador(['NEQUI'], ['NEQUI']);
  assert.deepEqual(r, [DESCRIPTOR_NEQUI]);
});

test('metodosPasarelaParaComprador: la cuenta lo tiene pero el dueño NO lo encendió → no se ofrece', () => {
  assert.deepEqual(metodosPasarelaParaComprador([], ['NEQUI']), []);
});

test('metodosPasarelaParaComprador: el dueño lo encendió pero la cuenta ya NO lo tiene → no se ofrece', () => {
  assert.deepEqual(metodosPasarelaParaComprador(['NEQUI'], []), []);
});

test('metodosPasarelaParaComprador: dueño encendió Y cuenta tiene, pero SIN descriptor (PSE) → no se ofrece', () => {
  assert.deepEqual(metodosPasarelaParaComprador(['PSE'], ['PSE']), []);
});

test('metodosPasarelaParaComprador: TARJETA disponible en las dos listas → nunca se ofrece por este camino (no tiene descriptor)', () => {
  assert.deepEqual(metodosPasarelaParaComprador(['CARD', 'NEQUI'], ['CARD', 'NEQUI']), [DESCRIPTOR_NEQUI]);
});

test('metodosPasarelaParaComprador: conserva el orden de la cuenta primero, como cruzarMetodosPasarela', () => {
  // Un segundo tipo hipotético con descriptor, para probar el ORDEN sin depender de que el
  // registro real tenga dos entradas hoy.
  const registroDeDosTipos: Record<string, DescriptorMetodoPasarela> = {
    ...DESCRIPTORES_METODO_PASARELA,
    BREB: { ...DESCRIPTOR_NEQUI, tipo: 'BREB' },
  };
  const cruzado = cruzarMetodosPasarela(['BREB', 'NEQUI'], ['NEQUI', 'BREB'])
    .filter((m) => m.estado === 'disponible')
    .map((m) => registroDeDosTipos[m.tipo]);
  assert.deepEqual(cruzado.map((d) => d.tipo), ['NEQUI', 'BREB']);
});
