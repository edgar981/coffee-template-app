import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDeVida, entradaHistorial, ESTADOS_HISTORIAL, CAP_HISTORIAL } from './historial';

// Las reglas puras del historial. El CORTE contra base real es del carril
// (historial-automatizacion.test.ts); acá se afirman la señal de vida y el mapeo,
// que son forma y no dependen de qué filas trae la consulta.

test('el corte es sólo lo que cambió algo — ENVIADO y FALLIDO', () => {
  assert.deepEqual([...ESTADOS_HISTORIAL], ['ENVIADO', 'FALLIDO']);
  // Un silencio (DUPLICADO/OMITIDO) y el pendiente de WhatsApp NO están.
  for (const fuera of ['DUPLICADO', 'OMITIDO', 'PENDIENTE_CANAL']) {
    assert.ok(!ESTADOS_HISTORIAL.includes(fuera as never), `${fuera} no es un hecho de historial`);
  }
});

test('la señal de vida: cuatro estados excluyentes', () => {
  assert.equal(estadoDeVida({ activo: false, ultima: { estado: 'ENVIADO' } }), 'apagada'); // apagada manda sobre todo
  assert.equal(estadoDeVida({ activo: true,  ultima: null }),                  'sin_casos');
  assert.equal(estadoDeVida({ activo: true,  ultima: { estado: 'ENVIADO' } }), 'viva');
  assert.equal(estadoDeVida({ activo: true,  ultima: { estado: 'FALLIDO' } }), 'fallo');
});

test('el "sobre qué" sale del payload, no de un join del targetId', () => {
  const e = entradaHistorial({
    estado: 'ENVIADO', canal: 'interno', targetType: 'order', targetId: 'o1',
    payload: { titulo: 'x', mensaje: 'La orden PED-1462 volvió sin entregar' }, createdAt: new Date(),
  });
  assert.equal(e.sobreQue, 'La orden PED-1462 volvió sin entregar');  // prefiere mensaje
  assert.equal(e.resultado, 'ok');
});

test('sin payload legible cae a targetType+targetId DECLARADO, no a un vacío', () => {
  const e = entradaHistorial({
    estado: 'ENVIADO', canal: 'interno', targetType: 'product', targetId: 'p9',
    payload: null, createdAt: new Date(),
  });
  assert.equal(e.sobreQue, 'product p9');
});

test('el label del resultado habla el vocabulario del canal', () => {
  const base = { targetType: 'order', targetId: 'o', payload: {}, createdAt: new Date() };
  assert.equal(entradaHistorial({ ...base, estado: 'ENVIADO', canal: 'interno' }).resultadoLabel, 'Avisó');
  assert.equal(entradaHistorial({ ...base, estado: 'ENVIADO', canal: 'email'   }).resultadoLabel, 'Envió');
  assert.equal(entradaHistorial({ ...base, estado: 'FALLIDO', canal: 'email'   }).resultadoLabel, 'Falló');
});

test('el cap es un número declarado, no un mágico inline', () => {
  assert.equal(CAP_HISTORIAL, 50);
});
