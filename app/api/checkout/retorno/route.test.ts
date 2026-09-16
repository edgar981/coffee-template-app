import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST, resolverRetorno, type RetornoIntentoDb, type RetornoIntentoRow } from './route';

// Capa 1 (con un doble en memoria, no una base) — la ruta de retorno de Wompi
// (§ WOMPI-RUTA-DE-RETORNO-1). Mismo patrón que `app/api/webhooks/wompi/route.test.ts`:
// `resolverRetorno` es inyectable por `db`, así que estos tests nunca tocan Postgres.

/** Un `PaymentIntent`+`order` doble en memoria, con SÓLO el método que la ruta usa
 *  (`RetornoIntentoDb`). */
function crearDbFake(filas: (RetornoIntentoRow & { reference: string })[]) {
  const llamadas = { findUnique: 0 };
  const db: RetornoIntentoDb = {
    paymentIntent: {
      async findUnique({ where }) {
        llamadas.findUnique++;
        const fila = filas.find((f) => f.reference === where.reference);
        return fila ? { estado: fila.estado, order: { ...fila.order } } : null;
      },
    },
  };
  return { db, llamadas };
}

// ── resolverRetorno: el segundo factor decide, nunca la reference sola ──────────

test('reference + email coinciden (EN_VUELO) → 200 con SÓLO estado + numero_orden', async () => {
  const { db } = crearDbFake([
    {
      reference: 'CN-100000:intent-1',
      estado:    'EN_VUELO',
      order:     { numero_orden: 'CN-100000', cliente_email: 'cliente@correo.com' },
    },
  ]);

  const resultado = await resolverRetorno({ reference: 'CN-100000:intent-1', email: 'cliente@correo.com' }, db);

  assert.equal(resultado.status, 200);
  assert.deepEqual(resultado.body, { estado: 'EN_VUELO', numero_orden: 'CN-100000' });
  // Nada más viaja: ni monto, ni datos del cliente, ni pspTransactionId.
  assert.deepEqual(Object.keys(resultado.body).sort(), ['estado', 'numero_orden']);
});

test('reference + email coinciden (APROBADO) → 200, el estado viaja TAL CUAL, sin reinterpretarlo', async () => {
  const { db } = crearDbFake([
    {
      reference: 'CN-100000:intent-1',
      estado:    'APROBADO',
      order:     { numero_orden: 'CN-100000', cliente_email: 'cliente@correo.com' },
    },
  ]);

  const resultado = await resolverRetorno({ reference: 'CN-100000:intent-1', email: 'cliente@correo.com' }, db);

  assert.equal(resultado.status, 200);
  assert.deepEqual(resultado.body, { estado: 'APROBADO', numero_orden: 'CN-100000' });
});

test('email NO coincide con el de la orden → 404 genérico, mismo que "no encontrado"', async () => {
  const { db } = crearDbFake([
    {
      reference: 'CN-100000:intent-1',
      estado:    'APROBADO',
      order:     { numero_orden: 'CN-100000', cliente_email: 'cliente@correo.com' },
    },
  ]);

  const resultado = await resolverRetorno({ reference: 'CN-100000:intent-1', email: 'otro@correo.com' }, db);

  assert.equal(resultado.status, 404);
  assert.deepEqual(resultado.body, { error: 'No encontrado' });
});

test('la comparación de email se NORMALIZA (trim + minúsculas) — no es un mismatch de forma', async () => {
  const { db } = crearDbFake([
    {
      reference: 'CN-100000:intent-1',
      estado:    'APROBADO',
      order:     { numero_orden: 'CN-100000', cliente_email: 'Cliente@Correo.com' },
    },
  ]);

  const resultado = await resolverRetorno(
    { reference: 'CN-100000:intent-1', email: '  cliente@correo.com  ' },
    db,
  );

  assert.equal(resultado.status, 200);
  assert.deepEqual(resultado.body, { estado: 'APROBADO', numero_orden: 'CN-100000' });
});

test('reference que no matchea ningún PaymentIntent → 404 genérico (no revela si existe)', async () => {
  const { db, llamadas } = crearDbFake([]);

  const resultado = await resolverRetorno(
    { reference: 'CN-no-existe:intent-x', email: 'cualquiera@correo.com' },
    db,
  );

  assert.equal(resultado.status, 404);
  assert.deepEqual(resultado.body, { error: 'No encontrado' });
  assert.equal(llamadas.findUnique, 1);
});

test('la orden dueña de la reference no tiene cliente_email (null) → 404, nunca revienta', async () => {
  const { db } = crearDbFake([
    {
      reference: 'CN-100000:intent-1',
      estado:    'FALLIDO',
      order:     { numero_orden: 'CN-100000', cliente_email: null },
    },
  ]);

  const resultado = await resolverRetorno({ reference: 'CN-100000:intent-1', email: 'cliente@correo.com' }, db);

  assert.equal(resultado.status, 404);
  assert.deepEqual(resultado.body, { error: 'No encontrado' });
});

// ── POST: la plomería que corre ANTES de tocar la base ──────────────────────────

test('POST: cuerpo que no es JSON → 404 genérico', async () => {
  const req = new NextRequest('http://localhost/api/checkout/retorno', {
    method:  'POST',
    body:    'esto no es json{',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
  });
  const res = await POST(req);
  assert.equal(res.status, 404);
});

test('POST: falta `email` en el body → 404 genérico (no dice cuál campo faltó)', async () => {
  const req = new NextRequest('http://localhost/api/checkout/retorno', {
    method:  'POST',
    body:    JSON.stringify({ reference: 'CN-100000:intent-1' }),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.11' },
  });
  const res = await POST(req);
  assert.equal(res.status, 404);
});

test('POST: `email` con forma inválida (sin @) → 404 genérico', async () => {
  const req = new NextRequest('http://localhost/api/checkout/retorno', {
    method:  'POST',
    body:    JSON.stringify({ reference: 'CN-100000:intent-1', email: 'no-es-un-correo' }),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.12' },
  });
  const res = await POST(req);
  assert.equal(res.status, 404);
});

test('POST: al superar el límite de la ventana → 429 con Retry-After', async () => {
  // IP dedicada a este test para no interferir con el conteo de los demás — el
  // limitador es un Map de proceso, compartido dentro del mismo archivo de test.
  const ip = '203.0.113.99';
  const cuerpoInvalido = JSON.stringify({}); // 404 antes de tocar la base, pero SÍ cuenta contra el límite.
  let ultimaRespuesta: Response | undefined;
  for (let i = 0; i < 21; i++) {
    const req = new NextRequest('http://localhost/api/checkout/retorno', {
      method:  'POST',
      body:    cuerpoInvalido,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    });
    ultimaRespuesta = await POST(req);
  }
  assert.equal(ultimaRespuesta?.status, 429);
  assert.ok(ultimaRespuesta?.headers.get('Retry-After'));
});
