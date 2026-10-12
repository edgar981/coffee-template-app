import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  referenciaDesdeQuery,
  extraerReferenciaDeTransaccion,
  resolverReferenciaPorId,
  HOSTS_PASARELA_RETORNO,
} from './retorno-wompi';

test('referenciaDesdeQuery: reference presente manda, igual que hoy — nunca dispara por_id', () => {
  assert.deepEqual(
    referenciaDesdeQuery({ reference: 'CN-123:abc', id: '999-ignorado' }),
    { tipo: 'directa', referencia: 'CN-123:abc' },
  );
  assert.deepEqual(
    referenciaDesdeQuery({ reference: '  CN-123:abc  ', id: null }),
    { tipo: 'directa', referencia: 'CN-123:abc' },
  );
});

test('referenciaDesdeQuery: sin reference, con id → por_id', () => {
  assert.deepEqual(
    referenciaDesdeQuery({ reference: null, id: '15000-ab-1' }),
    { tipo: 'por_id', id: '15000-ab-1' },
  );
  assert.deepEqual(
    referenciaDesdeQuery({ reference: '', id: '  15000-ab-1  ' }),
    { tipo: 'por_id', id: '15000-ab-1' },
  );
});

test('referenciaDesdeQuery: ni reference ni id → ninguna', () => {
  assert.deepEqual(referenciaDesdeQuery({}), { tipo: 'ninguna' });
  assert.deepEqual(referenciaDesdeQuery({ reference: '  ', id: '  ' }), { tipo: 'ninguna' });
});

test('extraerReferenciaDeTransaccion: forma documentada de Wompi → la referencia', () => {
  assert.equal(
    extraerReferenciaDeTransaccion({ data: { id: '15000-abc', reference: 'CN-958842:xyz', status: 'APPROVED' } }),
    'CN-958842:xyz',
  );
});

test('extraerReferenciaDeTransaccion: errores — nunca lanza, siempre null', () => {
  assert.equal(extraerReferenciaDeTransaccion(null), null);
  assert.equal(extraerReferenciaDeTransaccion(undefined), null);
  assert.equal(extraerReferenciaDeTransaccion('texto'), null);
  assert.equal(extraerReferenciaDeTransaccion({}), null);
  assert.equal(extraerReferenciaDeTransaccion({ data: null }), null);
  assert.equal(extraerReferenciaDeTransaccion({ data: 'no es un objeto' }), null);
  assert.equal(extraerReferenciaDeTransaccion({ data: {} }), null);
  assert.equal(extraerReferenciaDeTransaccion({ data: { reference: 42 } }), null);
  assert.equal(extraerReferenciaDeTransaccion({ data: { reference: '   ' } }), null);
  assert.equal(extraerReferenciaDeTransaccion({ error: { messages: {} } }), null);
});

test('resolverReferenciaPorId: el host que SÍ tiene la transacción gana', async () => {
  const llamadas: string[] = [];
  const fetchFalso = async (url: string) => {
    llamadas.push(url);
    if (url.startsWith(HOSTS_PASARELA_RETORNO[1])) {
      return { ok: true, json: async () => ({ data: { reference: 'CN-111:aaa' } }) };
    }
    return { ok: false, json: async () => ({}) };
  };
  const referencia = await resolverReferenciaPorId('tx-1', fetchFalso);
  assert.equal(referencia, 'CN-111:aaa');
  assert.equal(llamadas.length, 2);
  assert.ok(llamadas.every((u) => u.endsWith('/v1/transactions/tx-1')));
});

test('resolverReferenciaPorId: ningún host responde → null, sin lanzar', async () => {
  const fetchFalso = async () => ({ ok: false, json: async () => ({}) });
  assert.equal(await resolverReferenciaPorId('tx-404', fetchFalso), null);
});

test('resolverReferenciaPorId: un host responde 200 pero sin forma resoluble → null si el otro también falla', async () => {
  const fetchFalso = async (url: string) => {
    if (url.startsWith(HOSTS_PASARELA_RETORNO[0])) {
      return { ok: true, json: async () => ({ data: {} }) };
    }
    return { ok: false, json: async () => ({}) };
  };
  assert.equal(await resolverReferenciaPorId('tx-raro', fetchFalso), null);
});

test('resolverReferenciaPorId: un host LANZA (red caída) y el otro responde → sigue resolviendo', async () => {
  const fetchFalso = async (url: string) => {
    if (url.startsWith(HOSTS_PASARELA_RETORNO[0])) throw new Error('network down');
    return { ok: true, json: async () => ({ data: { reference: 'CN-222:bbb' } }) };
  };
  assert.equal(await resolverReferenciaPorId('tx-mixto', fetchFalso), 'CN-222:bbb');
});

test('resolverReferenciaPorId: codifica el id en la URL', async () => {
  const urls: string[] = [];
  const fetchFalso = async (url: string) => {
    urls.push(url);
    return { ok: false, json: async () => ({}) };
  };
  await resolverReferenciaPorId('id con espacio/raro', fetchFalso);
  assert.ok(urls.every((u) => u.includes(encodeURIComponent('id con espacio/raro'))));
});
