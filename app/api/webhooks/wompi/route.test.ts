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
//
// WOMPI-PAYMENT-DESDE-WEBHOOK-G-1 agregó `transaccionConOrdenLockeada` y
// `notificarAtencion` a `PaymentIntentDb`: el doble ahora también lleva un mapa de
// Órdenes en memoria (sin locking real — eso lo prueba `tests/integracion/`, NO
// este archivo, que se queda DB-free por la regla del carril rápido en `app/**`,
// § CLAUDE.md "El carril rápido cubre `app/`") y registra cada `registrarPago`/
// `notificarAtencion` para que los tests afirmen QUÉ se llamó, no sólo el status.

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

interface OrdenFake {
  estado: string;
  total: number;
  numero_orden: string;
}

interface NotificacionFake {
  tipo: string;
  titulo: string;
  mensaje: string;
  href: string;
}

/** Un `PaymentIntent` + `Order` dobles en memoria, con SÓLO lo que la ruta usa
 *  (`PaymentIntentDb`). Simula la unique de `pspTransactionId` (P2002 si otra fila
 *  YA la tiene), la transición condicional (`count === 0` si `estado` ya cambió) y
 *  — nuevo en (g) — el par lock-de-orden + registro de pago + notificación, todos
 *  como side-effects en memoria (SIN locking real: la concurrencia de verdad es
 *  del carril de integración). */
function crearDbFake(config: {
  filas: (PaymentIntentRow & { reference: string })[];
  ordenes?: Record<string, OrdenFake>;
}) {
  const filas = config.filas.map((f) => ({ ...f }));
  const ordenes = new Map(Object.entries(config.ordenes ?? {}).map(([id, o]) => [id, { ...o }]));
  const llamadas = {
    findUnique: 0,
    updateMany: 0,
    transacciones: 0,
    pagosRegistrados: [] as { ordenId: string; monto: number; referencia: string }[],
    notificaciones: [] as NotificacionFake[],
  };

  function cerrarIntent(
    where: { id: string; estado: 'EN_VUELO' },
    data: { pspTransactionId: string; estado: 'APROBADO' | 'FALLIDO'; estado_crudo_psp: string },
  ): { count: number } {
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
  }

  const db: PaymentIntentDb = {
    paymentIntent: {
      async findUnique({ where }) {
        llamadas.findUnique++;
        const fila = filas.find((f) => f.reference === where.reference);
        return fila ? { ...fila } : null;
      },
      async updateMany({ where, data }) {
        return cerrarIntent(where, data);
      },
    },
    async transaccionConOrdenLockeada(ordenId, fn) {
      llamadas.transacciones++;
      const orden = ordenes.get(ordenId) ?? null;
      return fn(orden ? { ...orden } : null, {
        paymentIntent: {
          async updateMany({ where, data }) {
            return cerrarIntent(where, data);
          },
        },
        async registrarPago({ monto, referencia }) {
          llamadas.pagosRegistrados.push({ ordenId, monto, referencia });
          const o = ordenes.get(ordenId);
          if (o) o.estado = 'pagado';
        },
      });
    },
    async notificarAtencion(input) {
      llamadas.notificaciones.push(input);
    },
  };
  return { db, filas, ordenes, llamadas };
}

// ── firma válida → el intento queda cerrado como corresponde ────────────────

test('firma válida, APPROVED sobre un intento EN_VUELO con la orden PENDIENTE → cierra APROBADO, asienta el id de transacción y crea el Payment', async () => {
  const { db, filas, ordenes, llamadas } = crearDbFake({
    filas: [{ id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null }],
    ordenes: { 'orden-1': { estado: 'pendiente', total: 45_000, numero_orden: 'CN-100000' } },
  });
  const evento = eventoTransaccion({ id: 'txn_abc', status: 'APPROVED', amount_in_cents: 4_500_000 });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'cerrado aprobado');
  assert.equal(filas[0].estado, 'APROBADO');
  assert.equal(filas[0].pspTransactionId, 'txn_abc');
  // El CUARTO llamador de `registerOrderPaymentTx`: el monto es el CONFIRMADO
  // (45.000, de los 4.500.000 centavos), la referencia es el id de transacción.
  assert.equal(llamadas.pagosRegistrados.length, 1);
  assert.deepEqual(llamadas.pagosRegistrados[0], { ordenId: 'orden-1', monto: 45_000, referencia: 'txn_abc' });
  assert.equal(ordenes.get('orden-1')?.estado, 'pagado');
  assert.equal(llamadas.notificaciones.length, 0);
});

test('firma válida, DECLINED sobre un intento EN_VUELO → cierra FALLIDO, sin tocar la Order ni crear Payment', async () => {
  const { db, filas, llamadas } = crearDbFake({
    filas: [{ id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null }],
  });
  const evento = eventoTransaccion({ id: 'txn_abc', status: 'DECLINED' });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'cerrado fallido');
  assert.equal(filas[0].estado, 'FALLIDO');
  assert.equal(filas[0].pspTransactionId, 'txn_abc');
  assert.equal(llamadas.transacciones, 0);
  assert.equal(llamadas.pagosRegistrados.length, 0);
});

test('estado no terminal (PENDING) → no cierra el intento, sigue EN_VUELO', async () => {
  const { db, filas } = crearDbFake({
    filas: [{ id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null }],
  });
  const evento = eventoTransaccion({ status: 'PENDING' });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'estado no terminal, sin cerrar');
  assert.equal(filas[0].estado, 'EN_VUELO');
  assert.equal(filas[0].pspTransactionId, null);
});

// ── firma inválida → 401, NADA escrito ───────────────────────────────────────

test('firma inválida (checksum alterado) → 401 y el intento no se toca', async () => {
  const { db, filas, llamadas } = crearDbFake({
    filas: [{ id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null }],
  });
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
  const { db, llamadas } = crearDbFake({
    filas: [{ id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null }],
  });
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

test('segunda entrega del MISMO evento (mismo id de transacción) → no duplica, responde 200 "repetido", UN solo Payment', async () => {
  const { db, filas, ordenes, llamadas } = crearDbFake({
    filas: [{ id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null }],
    ordenes: { 'orden-1': { estado: 'pendiente', total: 45_000, numero_orden: 'CN-100000' } },
  });
  const evento = eventoTransaccion({ id: 'txn_abc', status: 'APPROVED' });

  const primero = await procesarEventoWompi(evento, undefined, SECRETO, db);
  assert.equal(primero.status, 200);
  assert.equal(primero.motivo, 'cerrado aprobado');
  assert.equal(llamadas.updateMany, 1);
  assert.equal(llamadas.pagosRegistrados.length, 1);

  const segundo = await procesarEventoWompi(evento, undefined, SECRETO, db);
  assert.equal(segundo.status, 200);
  assert.equal(segundo.motivo, 'repetido');
  // La segunda entrega no vuelve a escribir el intento NI a registrar un pago —
  // el corte pasa en el chequeo pre-transacción (`intent.estado !== 'EN_VUELO'`),
  // así que `transaccionConOrdenLockeada` ni se llama la segunda vez.
  assert.equal(llamadas.updateMany, 1);
  assert.equal(llamadas.transacciones, 1);
  assert.equal(llamadas.pagosRegistrados.length, 1);
  assert.equal(filas[0].estado, 'APROBADO');
  assert.equal(filas[0].pspTransactionId, 'txn_abc');
  assert.equal(ordenes.get('orden-1')?.estado, 'pagado');
});

// ── referencia que no matchea ninguna fila → NO-200, para que Wompi reintente ─
//
// (WOMPI-WEBHOOK-RACE-REINTENTO-1) A diferencia de las otras ramas de `200`, acá el
// reintento SÍ ayuda: la fila puede aparecer un segundo después (la crea la etapa
// que inicia el checkout). Devolver `200` le diría a Wompi «no vuelvas» y un pago
// aprobado se perdería en silencio. Nada se escribe en esta rama — es lo que la
// hace segura para reintentar sin duplicar nada.

test('referencia sin match en ningún PaymentIntent → 404, sin escribir (para que Wompi reintente)', async () => {
  const { db, llamadas } = crearDbFake({ filas: [] });
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
  const { db, filas } = crearDbFake({
    filas: [{ id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'FALLIDO', monto_esperado: 45_000, pspTransactionId: 'txn_viejo' }],
  });
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

test('el id de transacción ya pertenece a OTRO PaymentIntent (P2002) → no revienta, responde 200, no pisa ni paga', async () => {
  const { db, filas, llamadas } = crearDbFake({
    filas: [
      { id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
      { id: 'pi_2', orden_id: 'orden-2', reference: 'CN-200000:intent-2', estado: 'APROBADO', monto_esperado: 10_000, pspTransactionId: 'txn_compartido' },
    ],
    ordenes: { 'orden-1': { estado: 'pendiente', total: 45_000, numero_orden: 'CN-100000' } },
  });
  const evento = eventoTransaccion({ id: 'txn_compartido', status: 'APPROVED' });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'id de transacción ya asentado en otro intento');
  // No se pisó: `pi_1` sigue EN_VUELO, `pi_2` sigue como estaba, y NO se creó Payment
  // — el choque ocurre ANTES de `registrarPago`, dentro de la MISMA transacción que
  // se revierte entera.
  assert.equal(filas[0].estado, 'EN_VUELO');
  assert.equal(filas[1].pspTransactionId, 'txn_compartido');
  assert.equal(llamadas.pagosRegistrados.length, 0);
});

// ── extra: discrepancia de monto se registra Y avisa al carril de atención ──

test('discrepancia de monto entre el evento y `monto_esperado` se REGISTRA, no cambia el desenlace, Y notifica al carril de atención', async () => {
  const { db, filas, llamadas } = crearDbFake({
    filas: [{ id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 99_999, pspTransactionId: null }],
    ordenes: { 'orden-1': { estado: 'pendiente', total: 99_999, numero_orden: 'CN-100000' } },
  });
  const errorSpy = mock.method(console, 'error', () => {});
  try {
    // 4.500.000 centavos = $45.000, distinto de los $99.999 esperados.
    const evento = eventoTransaccion({ id: 'txn_abc', status: 'APPROVED', amount_in_cents: 4_500_000 });

    const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

    assert.equal(resultado.status, 200);
    assert.equal(resultado.motivo, 'cerrado aprobado');
    assert.equal(filas[0].estado, 'APROBADO');
    // Se pagó por el monto CONFIRMADO (45.000), no por el esperado (99.999).
    assert.equal(llamadas.pagosRegistrados.length, 1);
    assert.equal(llamadas.pagosRegistrados[0].monto, 45_000);
    assert.ok(errorSpy.mock.calls.some((c) => String(c.arguments[0]).includes('discrepancia de monto')));
    assert.equal(llamadas.notificaciones.length, 1);
    assert.equal(llamadas.notificaciones[0].tipo, 'wompi_monto_discrepante');
    assert.match(llamadas.notificaciones[0].mensaje, /CN-100000/);
  } finally {
    errorSpy.mock.restore();
  }
});

// ── WOMPI-PAYMENT-DESDE-WEBHOOK-G-1: el cobro duplicado ─────────────────────

test('SEGUNDO PaymentIntent APROBADO sobre una orden que YA está pagada → cierra su intento, NO crea un segundo Payment, notifica al carril de atención', async () => {
  const { db, filas, ordenes, llamadas } = crearDbFake({
    filas: [
      { id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'APROBADO', monto_esperado: 45_000, pspTransactionId: 'txn_primero' },
      { id: 'pi_2', orden_id: 'orden-1', reference: 'CN-100000:intent-2', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
    ],
    ordenes: { 'orden-1': { estado: 'pagado', total: 45_000, numero_orden: 'CN-100000' } },
  });
  const evento = eventoTransaccion({ id: 'txn_segundo', reference: 'CN-100000:intent-2', status: 'APPROVED', amount_in_cents: 4_500_000 });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'cerrado aprobado (cobro duplicado)');
  // El HECHO de Wompi se guarda igual: el segundo intento SÍ cierra APROBADO.
  assert.equal(filas[1].estado, 'APROBADO');
  assert.equal(filas[1].pspTransactionId, 'txn_segundo');
  // Pero NO se crea un segundo Payment ni se reabre/toca la orden.
  assert.equal(llamadas.pagosRegistrados.length, 0);
  assert.equal(ordenes.get('orden-1')?.estado, 'pagado');
  // El carril de atención se entera — un solo aviso, con el número de orden.
  assert.equal(llamadas.notificaciones.length, 1);
  assert.equal(llamadas.notificaciones[0].tipo, 'wompi_cobro_duplicado');
  assert.equal(llamadas.notificaciones[0].href, '/admin/pedidos?pedido=CN-100000');
  assert.match(llamadas.notificaciones[0].mensaje, /CN-100000/);
});

test('dos PaymentIntent DISTINTOS de la MISMA orden, ambos APROBADO → UN solo Payment total y UNA sola notificación de cobro duplicado', async () => {
  const { db, ordenes, llamadas } = crearDbFake({
    filas: [
      { id: 'pi_1', orden_id: 'orden-1', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
      { id: 'pi_2', orden_id: 'orden-1', reference: 'CN-100000:intent-2', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null },
    ],
    ordenes: { 'orden-1': { estado: 'pendiente', total: 45_000, numero_orden: 'CN-100000' } },
  });

  const primero = await procesarEventoWompi(
    eventoTransaccion({ id: 'txn_1', reference: 'CN-100000:intent-1', status: 'APPROVED', amount_in_cents: 4_500_000 }),
    undefined, SECRETO, db,
  );
  assert.equal(primero.motivo, 'cerrado aprobado');

  const segundo = await procesarEventoWompi(
    eventoTransaccion({ id: 'txn_2', reference: 'CN-100000:intent-2', status: 'APPROVED', amount_in_cents: 4_500_000 }),
    undefined, SECRETO, db,
  );
  assert.equal(segundo.motivo, 'cerrado aprobado (cobro duplicado)');

  assert.equal(llamadas.pagosRegistrados.length, 1);
  assert.equal(llamadas.notificaciones.length, 1);
  assert.equal(llamadas.notificaciones[0].tipo, 'wompi_cobro_duplicado');
  assert.equal(ordenes.get('orden-1')?.estado, 'pagado');
});

test('el PaymentIntent apunta a una Order inexistente (no debería pasar; hay FK) → no revienta, no crea Payment, no notifica', async () => {
  const { db, filas, llamadas } = crearDbFake({
    filas: [{ id: 'pi_1', orden_id: 'orden-fantasma', reference: 'CN-100000:intent-1', estado: 'EN_VUELO', monto_esperado: 45_000, pspTransactionId: null }],
    ordenes: {},
  });
  const errorSpy = mock.method(console, 'error', () => {});
  try {
    const evento = eventoTransaccion({ id: 'txn_abc', status: 'APPROVED' });

    const resultado = await procesarEventoWompi(evento, undefined, SECRETO, db);

    assert.equal(resultado.status, 200);
    assert.equal(resultado.motivo, 'orden del intento no encontrada');
    // El intento no se tocó: el `!orden` corta ANTES del `updateMany`.
    assert.equal(filas[0].estado, 'EN_VUELO');
    assert.equal(llamadas.pagosRegistrados.length, 0);
    assert.equal(llamadas.notificaciones.length, 0);
  } finally {
    errorSpy.mock.restore();
  }
});
