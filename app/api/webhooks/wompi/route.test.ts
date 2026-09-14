import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import type { EventoWompi } from '@/lib/pagos/wompi-firma';
import { POST, procesarEventoWompi, type PaymentIntentDb, type PaymentIntentRow } from './route';

// Capa 1 (con un doble en memoria, no una base) — la ruta del webhook de Wompi.
//
// El secreto es INVENTADO para el test, como en `lib/pagos/wompi-firma.test.ts`:
// ninguna llave, prefijo ni longitud real. El caso dorado se calcula con la MISMA
// fórmula que el verificador (sha256 de properties+timestamp+secreto), nunca
// copiado del ejemplo de la doc de Wompi — está medido (WOMPI-REGLAS-
// IMPLEMENTACION-1) que ese ejemplo no reproduce.

const SECRETO = 'secreto-de-prueba-inventado-para-el-webhook-wompi';

function checksumEsperado(
  data: Record<string, unknown>,
  properties: string[],
  timestamp: number | string,
  secreto: string,
): string {
  const resolver = (ruta: string): string =>
    String(ruta.split('.').reduce<unknown>((acc, parte) => (acc as Record<string, unknown>)?.[parte], data));
  const cadena = properties.map(resolver).join('') + String(timestamp) + secreto;
  return createHash('sha256').update(cadena).digest('hex');
}

const PROPERTIES = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
const TIMESTAMP = 1_726_000_000;

/** Un evento `transaction.updated` sintético, con el checksum calculado para el
 *  secreto y los datos dados — nunca hardcodeado. */
function eventoTransaccion(
  overrides: { id?: string; reference?: string; status?: string; amount_in_cents?: number } = {},
  secreto: string = SECRETO,
): EventoWompi {
  const data = {
    transaction: {
      id:               overrides.id ?? 'txn_test_1',
      reference:        overrides.reference ?? 'CN-100000:intent-1',
      status:           overrides.status ?? 'APPROVED',
      amount_in_cents:  overrides.amount_in_cents ?? 4_500_000,
    },
  };
  const checksum = checksumEsperado(data, PROPERTIES, TIMESTAMP, secreto);
  return { data, timestamp: TIMESTAMP, signature: { properties: PROPERTIES, checksum } };
}

/** Un `PaymentIntent` doble en memoria, con SÓLO los dos métodos que la ruta usa
 *  (`PaymentIntentDb`). Simula la unique de `pspTransactionId` (P2002 si otra fila
 *  YA la tiene) y la transición condicional (`count === 0` si `estado` ya cambió). */
function crearDbFake(filasIniciales: (PaymentIntentRow & { reference: string })[]) {
  const filas = filasIniciales.map((f) => ({ ...f }));
  const llamadas = { findUnique: 0, updateMany: 0 };
  const db: PaymentIntentDb = {
    paymentIntent: {
      async findUnique({ where }) {
        llamadas.findUnique++;
        const fila = filas.find((f) => f.reference === where.reference);
        return fila ? { ...fila } : null;
      },
      async updateMany({ where, data }) {
        llamadas.updateMany++;
        const colision = filas.find((f) => f.id !== where.id && f.pspTransactionId === data.pspTransactionId);
        if (colision) {
          const err = new Error('Unique constraint failed on pspTransactionId') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        const fila = filas.find((f) => f.id === where.id && f.estado === where.estado);
        if (!fila) return { count: 0 };
        fila.estado = data.estado;
        fila.pspTransactionId = data.pspTransactionId;
        return { count: 1 };
      },
    },
  };
  return { db, filas, llamadas };
}

// ── firma válida → el intento queda cerrado como corresponde ────────────────

test('firma válida, APPROVED sobre un intento EN_VUELO → cierra APROBADO y asienta el id de transacción', async () => {
  const { db, filas } = crearDbFake([
    { id: 'pi_1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
  ]);
  const evento = eventoTransaccion({ id: 'txn_abc', status: 'APPROVED', amount_in_cents: 4_500_000 });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'cerrado aprobado');
  assert.equal(filas[0].estado, 'APROBADO');
  assert.equal(filas[0].pspTransactionId, 'txn_abc');
});

test('firma válida, DECLINED sobre un intento EN_VUELO → cierra FALLIDO', async () => {
  const { db, filas } = crearDbFake([
    { id: 'pi_1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
  ]);
  const evento = eventoTransaccion({ id: 'txn_abc', status: 'DECLINED' });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'cerrado fallido');
  assert.equal(filas[0].estado, 'FALLIDO');
  assert.equal(filas[0].pspTransactionId, 'txn_abc');
});

test('estado no terminal (PENDING) → no cierra el intento, sigue EN_VUELO', async () => {
  const { db, filas } = crearDbFake([
    { id: 'pi_1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
  ]);
  const evento = eventoTransaccion({ status: 'PENDING' });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'estado no terminal, sin cerrar');
  assert.equal(filas[0].estado, 'EN_VUELO');
  assert.equal(filas[0].pspTransactionId, null);
});

// ── firma inválida → 401, NADA escrito ───────────────────────────────────────

test('firma inválida (checksum alterado) → 401 y el intento no se toca', async () => {
  const { db, filas, llamadas } = crearDbFake([
    { id: 'pi_1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
  ]);
  const evento = eventoTransaccion();
  const roto: EventoWompi = {
    ...evento,
    signature: { ...evento.signature, checksum: 'f'.repeat(64) },
  };

  const resultado = await procesarEventoWompi(roto, undefined, SECRETO, db);

  assert.equal(resultado.status, 401);
  assert.equal(resultado.motivo, 'firma inválida');
  assert.equal(llamadas.findUnique, 0);
  assert.equal(llamadas.updateMany, 0);
  assert.equal(filas[0].estado, 'EN_VUELO');
});

test('un `properties` que no resuelve (RutaDePropertyNoResuelveError) → 401, tratado como firma inválida, nada escrito', async () => {
  const { db, llamadas } = crearDbFake([
    { id: 'pi_1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
  ]);
  const evento: EventoWompi = {
    data: { transaction: { id: 'txn_1', status: 'APPROVED' } },
    timestamp: TIMESTAMP,
    signature: { properties: ['transaction.no_existe'], checksum: 'x'.repeat(64) },
  };

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 401);
  assert.equal(resultado.motivo, 'evento no verificable');
  assert.equal(llamadas.findUnique, 0);
});

// ── firma inválida y falta el secreto, a nivel de RUTA (POST) ────────────────

test('POST: falta WOMPI_EVENTS_SECRET → 500, sin filtrar nada', async () => {
  const anterior = process.env.WOMPI_EVENTS_SECRET;
  delete process.env.WOMPI_EVENTS_SECRET;
  try {
    const req = new NextRequest('http://localhost/api/webhooks/wompi', {
      method: 'POST',
      body: JSON.stringify(eventoTransaccion()),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    assert.equal(res.status, 500);
    const cuerpo = await res.json();
    assert.equal(typeof cuerpo.error, 'string');
    // La respuesta no repite el secreto (no hay ninguno) ni ningún dato del env.
    assert.doesNotMatch(JSON.stringify(cuerpo), /WOMPI_EVENTS_SECRET/);
  } finally {
    if (anterior === undefined) delete process.env.WOMPI_EVENTS_SECRET;
    else process.env.WOMPI_EVENTS_SECRET = anterior;
  }
});

test('POST: firma inválida a nivel HTTP → 401 (el secreto SÍ está configurado)', async () => {
  const anterior = process.env.WOMPI_EVENTS_SECRET;
  process.env.WOMPI_EVENTS_SECRET = SECRETO;
  try {
    const evento = eventoTransaccion();
    const roto = { ...evento, signature: { ...evento.signature, checksum: 'f'.repeat(64) } };
    const req = new NextRequest('http://localhost/api/webhooks/wompi', {
      method: 'POST',
      body: JSON.stringify(roto),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    assert.equal(res.status, 401);
  } finally {
    if (anterior === undefined) delete process.env.WOMPI_EVENTS_SECRET;
    else process.env.WOMPI_EVENTS_SECRET = anterior;
  }
});

test('POST: cuerpo que no es JSON → 401', async () => {
  const anterior = process.env.WOMPI_EVENTS_SECRET;
  process.env.WOMPI_EVENTS_SECRET = SECRETO;
  try {
    const req = new NextRequest('http://localhost/api/webhooks/wompi', {
      method: 'POST',
      body: 'esto no es json{',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    assert.equal(res.status, 401);
  } finally {
    if (anterior === undefined) delete process.env.WOMPI_EVENTS_SECRET;
    else process.env.WOMPI_EVENTS_SECRET = anterior;
  }
});

test('POST: cuerpo JSON con forma inesperada (sin signature) → 401', async () => {
  const anterior = process.env.WOMPI_EVENTS_SECRET;
  process.env.WOMPI_EVENTS_SECRET = SECRETO;
  try {
    const req = new NextRequest('http://localhost/api/webhooks/wompi', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    assert.equal(res.status, 401);
  } finally {
    if (anterior === undefined) delete process.env.WOMPI_EVENTS_SECRET;
    else process.env.WOMPI_EVENTS_SECRET = anterior;
  }
});

// ── segunda entrega del MISMO evento → no duplica, responde 200 ─────────────

test('segunda entrega del MISMO evento (mismo id de transacción) → no duplica, responde 200 "repetido"', async () => {
  const { db, filas, llamadas } = crearDbFake([
    { id: 'pi_1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
  ]);
  const evento = eventoTransaccion({ id: 'txn_abc', status: 'APPROVED' });

  const primero = await procesarEventoWompi(evento, undefined, SECRETO, db);
  assert.equal(primero.status, 200);
  assert.equal(primero.motivo, 'cerrado aprobado');
  assert.equal(llamadas.updateMany, 1);

  const segundo = await procesarEventoWompi(evento, undefined, SECRETO, db);
  assert.equal(segundo.status, 200);
  assert.equal(segundo.motivo, 'repetido');
  // La segunda entrega no vuelve a escribir: el estado ya era terminal.
  assert.equal(llamadas.updateMany, 1);
  assert.equal(filas[0].estado, 'APROBADO');
  assert.equal(filas[0].pspTransactionId, 'txn_abc');
});

// ── referencia que no matchea ninguna fila → NO-200, para que Wompi reintente ─
//
// (WOMPI-WEBHOOK-RACE-REINTENTO-1) A diferencia de las otras ramas de `200`, acá el
// reintento SÍ ayuda: la fila puede aparecer un segundo después (la crea la etapa
// que inicia el checkout). Devolver `200` le diría a Wompi «no vuelvas» y un pago
// aprobado se perdería en silencio. Nada se escribe en esta rama — es lo que la
// hace segura para reintentar sin duplicar nada.

test('referencia sin match en ningún PaymentIntent → 404, sin escribir (para que Wompi reintente)', async () => {
  const { db, llamadas } = crearDbFake([]);
  const evento = eventoTransaccion({ reference: 'CN-no-existe:intent-x' });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 404);
  assert.equal(resultado.motivo, 'referencia sin match');
  // Nada se escribe: ni update de un intento (no hay ninguno) ni ninguna otra
  // mutación — es justo lo que hace inofensivo dejar que Wompi reintente.
  assert.equal(llamadas.updateMany, 0);
});

// ── evento aprobado sobre un intento ya terminal → no pisa y lo registra ────

test('evento sobre un intento YA terminal que CONTRADICE lo asentado → ANOMALÍA, no pisa el veredicto anterior', async () => {
  const { db, filas } = crearDbFake([
    { id: 'pi_1', reference: 'CN-100000:intent-1', estado: 'FALLIDO', monto_esperado: 45_000, pspTransactionId: 'txn_viejo' },
  ]);
  const errorSpy = mock.method(console, 'error', () => {});
  try {
    const evento = eventoTransaccion({ id: 'txn_nuevo', status: 'APPROVED' });

    const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

    assert.equal(resultado.status, 200);
    assert.equal(resultado.motivo, 'anomalía sobre intento terminal');
    // El veredicto anterior NO se pisa.
    assert.equal(filas[0].estado, 'FALLIDO');
    assert.equal(filas[0].pspTransactionId, 'txn_viejo');
    assert.ok(errorSpy.mock.calls.some((c) => String(c.arguments[0]).includes('ANOMALÍA')));
  } finally {
    errorSpy.mock.restore();
  }
});

// ── extra: choque de `pspTransactionId` con OTRA fila (P2002) — defensivo ───

test('el id de transacción ya pertenece a OTRO PaymentIntent (P2002) → no revienta, responde 200, no pisa', async () => {
  const { db, filas } = crearDbFake([
    { id: 'pi_1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
    { id: 'pi_2', reference: 'CN-200000:intent-2', estado: 'APROBADO', monto_esperado: 10_000, pspTransactionId: 'txn_compartido' },
  ]);
  const evento = eventoTransaccion({ id: 'txn_compartido', status: 'APPROVED' });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'id de transacción ya asentado en otro intento');
  // No se pisó: `pi_1` sigue EN_VUELO, `pi_2` sigue como estaba.
  assert.equal(filas[0].estado, 'EN_VUELO');
  assert.equal(filas[1].pspTransactionId, 'txn_compartido');
});

// ── extra: discrepancia de monto se registra pero no cambia el desenlace ───

test('discrepancia de monto entre el evento y `monto_esperado` se REGISTRA pero no cambia el desenlace', async () => {
  const { db, filas } = crearDbFake([
    { id: 'pi_1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 99_999, pspTransactionId: null },
  ]);
  const errorSpy = mock.method(console, 'error', () => {});
  try {
    // 4.500.000 centavos = $45.000, distinto de los $99.999 esperados.
    const evento = eventoTransaccion({ id: 'txn_abc', status: 'APPROVED', amount_in_cents: 4_500_000 });

    const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

    assert.equal(resultado.status, 200);
    assert.equal(resultado.motivo, 'cerrado aprobado');
    assert.equal(filas[0].estado, 'APROBADO');
    assert.ok(errorSpy.mock.calls.some((c) => String(c.arguments[0]).includes('discrepancia de monto')));
  } finally {
    errorSpy.mock.restore();
  }
});
