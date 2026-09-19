import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  POST, resolverRedireccionPasarela, type ResolverRedireccionPasarelaDeps,
} from './route';
import type { DescriptorMetodoPasarela, CampoTextoLibre } from '@/lib/pagos/metodos-pasarela';
import { DESCRIPTOR_NEQUI } from '@/lib/pagos/metodos-pasarela';

// Capa 1 (con un doble en memoria, no una base ni red) — el mecanismo de redirección
// (§ API-DIRECTA-MECANISMO-REDIRECCION-1). Mismo patrón que `app/api/checkout/retorno/
// route.test.ts`: `resolverRedireccionPasarela` es inyectable por `deps`, así que estos tests
// nunca tocan Wompi ni Postgres.
//
// EL DESCRIPTOR SINTÉTICO USA SU PROPIO NOMBRE DE CAMPO, un CUARTO distinto de los tres que ya
// usa `lib/pagos/metodos-pasarela.test.ts` (`direccion_de_pago_banco_digital`,
// `async_payment_url`, `redirect_url`) y del quinto que usa ese mismo archivo para
// `urlDeRedireccionEnLista` (`pasarela_redireccion_href`) — probar con un nombre repetido
// volvería a probar el caso particular (§2 del reporte del slice).

const CAMPO_DE_PRUEBA: CampoTextoLibre = {
  nombre: 'numero', rotulo: 'Número', placeholder: '000', naturaleza: 'texto_libre', validar: () => null,
};

const DESCRIPTOR_QUE_REDIRIGE: DescriptorMetodoPasarela = {
  tipo: 'RUTA_DE_PRUEBA_QUE_REDIRIGE', nombreVisible: 'De prueba (nunca ofrecido)', grupo: 'debito_bancario',
  campos: [CAMPO_DE_PRUEBA],
  redireccion: { campoUrl: 'a_donde_hay_que_llevar_al_comprador' },
  construirPaymentMethod: () => ({ type: 'RUTA_DE_PRUEBA_QUE_REDIRIGE' }),
  campo: CAMPO_DE_PRUEBA,
};

function depsCon(overrides: Partial<ResolverRedireccionPasarelaDeps> = {}): ResolverRedireccionPasarelaDeps {
  return {
    registro: { [DESCRIPTOR_QUE_REDIRIGE.tipo]: DESCRIPTOR_QUE_REDIRIGE, NEQUI: DESCRIPTOR_NEQUI },
    consultar: async () => [],
    ...overrides,
  };
}

// ── A) LA RELECTURA + EXTRACCIÓN, con el nombre de campo del descriptor ─────────────────────

test('la dirección YA apareció en la relectura → 200, url extraída con el campoUrl del descriptor', async () => {
  const resultado = await resolverRedireccionPasarela(
    { reference: 'CN-100000:intent-1', tipo: DESCRIPTOR_QUE_REDIRIGE.tipo },
    depsCon({
      consultar: async () => [
        { id: 't1', status: 'PENDING', a_donde_hay_que_llevar_al_comprador: 'https://banco.example/pagar/abc' },
      ],
    }),
  );
  assert.equal(resultado.status, 200);
  assert.deepEqual(resultado.body, { url: 'https://banco.example/pagar/abc' });
});

test('la relectura trae VARIAS transacciones — se prueban en orden, la primera con el campo gana', async () => {
  const resultado = await resolverRedireccionPasarela(
    { reference: 'CN-100000:intent-1', tipo: DESCRIPTOR_QUE_REDIRIGE.tipo },
    depsCon({
      consultar: async () => [
        { id: 't1', status: 'PENDING' },
        { id: 't2', status: 'PENDING', a_donde_hay_que_llevar_al_comprador: 'https://banco.example/pagar/t2' },
      ],
    }),
  );
  assert.equal(resultado.status, 200);
  assert.deepEqual(resultado.body, { url: 'https://banco.example/pagar/t2' });
});

test('un campo de OTRO nombre en la respuesta no cuenta — el descriptor busca EXACTAMENTE el suyo', async () => {
  const resultado = await resolverRedireccionPasarela(
    { reference: 'CN-100000:intent-1', tipo: DESCRIPTOR_QUE_REDIRIGE.tipo },
    depsCon({
      consultar: async () => [
        { id: 't1', status: 'PENDING', async_payment_url: 'https://no-es-el-campo-de-este-descriptor.co' },
      ],
    }),
  );
  assert.equal(resultado.status, 200);
  assert.deepEqual(resultado.body, { url: null });
});

// ── EL CASO EN QUE LA DIRECCIÓN NUNCA APARECE — "no inventes un veredicto" ──────────────────

test('la lista de transacciones está vacía ("la regla del array vacío") → url: null, 200, NUNCA un error', async () => {
  const resultado = await resolverRedireccionPasarela(
    { reference: 'CN-100000:intent-1', tipo: DESCRIPTOR_QUE_REDIRIGE.tipo },
    depsCon({ consultar: async () => [] }),
  );
  assert.equal(resultado.status, 200);
  assert.deepEqual(resultado.body, { url: null });
});

test('hay transacciones pero NINGUNA trae el campo todavía → url: null, 200 — sigue "en vuelo", no "falló"', async () => {
  const resultado = await resolverRedireccionPasarela(
    { reference: 'CN-100000:intent-1', tipo: DESCRIPTOR_QUE_REDIRIGE.tipo },
    depsCon({ consultar: async () => [{ id: 't1', status: 'PENDING' }, { id: 't2', status: 'PENDING' }] }),
  );
  assert.equal(resultado.status, 200);
  assert.deepEqual(resultado.body, { url: null });
});

test('la consulta a Wompi FALLA (red, timeout) → 502 DISTINTO de "url: null" — no es lo mismo "no apareció" que "no se pudo preguntar"', async () => {
  const resultado = await resolverRedireccionPasarela(
    { reference: 'CN-100000:intent-1', tipo: DESCRIPTOR_QUE_REDIRIGE.tipo },
    depsCon({ consultar: async () => { throw new Error('fallo de red simulado'); } }),
  );
  assert.equal(resultado.status, 502);
  assert.ok('error' in resultado.body);
});

// ── LOS TIPOS QUE NO CALIFICAN PARA ESTA RUTA ───────────────────────────────────────────────

test('un tipo QUE NO ESTÁ en el registro → 400, nunca consulta a Wompi', async () => {
  let consultas = 0;
  const resultado = await resolverRedireccionPasarela(
    { reference: 'CN-100000:intent-1', tipo: 'NO_EXISTE' },
    depsCon({ consultar: async () => { consultas++; return []; } }),
  );
  assert.equal(resultado.status, 400);
  assert.equal(consultas, 0);
});

test('un tipo del registro que NO declara redireccion (NEQUI) → 400, nunca consulta a Wompi', async () => {
  let consultas = 0;
  const resultado = await resolverRedireccionPasarela(
    { reference: 'CN-100000:intent-1', tipo: 'NEQUI' },
    depsCon({ consultar: async () => { consultas++; return []; } }),
  );
  assert.equal(resultado.status, 400);
  assert.equal(consultas, 0);
});

// ── POST: la plomería que corre ANTES de consultar a Wompi ──────────────────────────────────

test('POST: cuerpo que no es JSON → 400', async () => {
  const req = new NextRequest('http://localhost/api/pasarela/redireccion', {
    method:  'POST',
    body:    'esto no es json{',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.20' },
  });
  const res = await POST(req);
  assert.equal(res.status, 400);
});

test('POST: falta `tipo` en el body → 400', async () => {
  const req = new NextRequest('http://localhost/api/pasarela/redireccion', {
    method:  'POST',
    body:    JSON.stringify({ reference: 'CN-100000:intent-1' }),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.21' },
  });
  const res = await POST(req);
  assert.equal(res.status, 400);
});

test('POST: sin WOMPI_PRIVATE_KEY en el entorno → 500 ruidoso, nunca un 200 a medias', async () => {
  const previa = process.env.WOMPI_PRIVATE_KEY;
  delete process.env.WOMPI_PRIVATE_KEY;
  try {
    const req = new NextRequest('http://localhost/api/pasarela/redireccion', {
      method:  'POST',
      body:    JSON.stringify({ reference: 'CN-100000:intent-1', tipo: 'NEQUI' }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.22' },
    });
    const res = await POST(req);
    assert.equal(res.status, 500);
  } finally {
    if (previa !== undefined) process.env.WOMPI_PRIVATE_KEY = previa;
  }
});

test('POST: al superar el límite de la ventana → 429 con Retry-After', async () => {
  // IP dedicada a este test para no interferir con el conteo de los demás — el limitador es un
  // Map de proceso, compartido dentro del mismo archivo de test (mismo patrón que
  // `app/api/checkout/retorno/route.test.ts`).
  const ip = '203.0.113.98';
  const cuerpoInvalido = JSON.stringify({});
  let ultimaRespuesta: Response | undefined;
  for (let i = 0; i < 21; i++) {
    const req = new NextRequest('http://localhost/api/pasarela/redireccion', {
      method:  'POST',
      body:    cuerpoInvalido,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    });
    ultimaRespuesta = await POST(req);
  }
  assert.equal(ultimaRespuesta?.status, 429);
  assert.ok(ultimaRespuesta?.headers.get('Retry-After'));
});
