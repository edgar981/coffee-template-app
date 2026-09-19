import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { pasarelaDisponibleEnEsteDespliegue, confirmarTransaccionTarjeta, CreacionTransaccionError } from './checkout.service';

// NOTA DE ALCANCE (§ WOMPI-TOGGLE-DISPONIBILIDAD-1): `npm test` sólo corre
// `lib/**/*.test.ts`, `constants/**/*.test.ts` y `packages/core/**/*.test.ts`
// (medido en `package.json:14`) — `services/**` NO está en ese glob, así que
// `npm run gate` NO ejecuta este archivo. Es el MISMO hueco sistémico que ya
// documenta `app/api/checkout/route.test.ts` (§ WOMPI-WIDGET-EN-EL-CANONICO-1),
// no algo nuevo de este slice. Se corre a mano con:
//   node --import tsx --test services/checkout.service.test.ts
//
// El predicado, aunque está mal ubicado para el gate, es la ÚNICA fuente que
// lee el cliente (`checkout/page.tsx`) y el servidor (`app/api/checkout/
// route.ts`) para decidir si la pasarela está disponible en este despliegue.

const VAR = 'NEXT_PUBLIC_PASARELA_HABILITADA';
const previo = process.env[VAR];

afterEach(() => {
  // Restaurar SIEMPRE: otros tests del proceso comparten process.env.
  previo === undefined ? delete process.env[VAR] : (process.env[VAR] = previo);
});

test('sin la variable de despliegue: la pasarela NO está disponible', () => {
  delete process.env[VAR];
  assert.equal(pasarelaDisponibleEnEsteDespliegue(), false);
});

test('con la variable en cualquier valor que no sea el literal "1": tampoco disponible', () => {
  process.env[VAR] = 'true';
  assert.equal(pasarelaDisponibleEnEsteDespliegue(), false);
  process.env[VAR] = '0';
  assert.equal(pasarelaDisponibleEnEsteDespliegue(), false);
  process.env[VAR] = '';
  assert.equal(pasarelaDisponibleEnEsteDespliegue(), false);
});

test('con la variable en "1": la pasarela SÍ está disponible', () => {
  process.env[VAR] = '1';
  assert.equal(pasarelaDisponibleEnEsteDespliegue(), true);
});

// ── confirmarTransaccionTarjeta (§ API-DIRECTA-DESALINEO-CABLEADO-1) ────────────────────
//
// Envuelve `fetch('/api/checkout', { method: 'PATCH' })`; estos tests stubean `global.fetch`
// —no hay red— y afirman que la clasificación que ya devuelve el servidor
// (`ResultadoCreacionTransaccionWompi`, `types/payment.ts`) llega intacta al llamador vía
// `CreacionTransaccionError.tipo`, que es lo que `FormularioTarjeta.tsx` usa para decidir si
// deja de ofrecer la tarjeta (`metodo_no_habilitado`) o muestra un error que sí admite
// reintentar (`firma_invalida`, `otro_fallo`).
//
// MISMA NOTA DE ALCANCE que arriba: `services/**` no está en el glob de `npm test`
// (`package.json:14`), así que `npm run gate` NO corre este bloque. Se corre a mano con:
//   node --import tsx --test services/checkout.service.test.ts

const fetchOriginal = global.fetch;

function stubFetch(status: number, body: unknown) {
  global.fetch = (async () => ({
    ok:   status >= 200 && status < 300,
    json: async () => body,
  })) as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = fetchOriginal;
});

test('tipo "creada" → resuelve sin lanzar', async () => {
  stubFetch(201, { tipo: 'creada', id: 'txn_1', status: 'PENDING' });
  await assert.doesNotReject(() =>
    confirmarTransaccionTarjeta({
      reference: 'CN-1:abc',
      tokenTarjeta: 'tok_1',
      aceptaciones: { terminos: 'acc_1', datosPersonales: 'acc_2' },
    }),
  );
});

test('tipo "metodo_no_habilitado" → lanza CreacionTransaccionError con ese tipo', async () => {
  stubFetch(502, { tipo: 'metodo_no_habilitado', error: 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.' });
  await assert.rejects(
    () => confirmarTransaccionTarjeta({
      reference: 'CN-1:abc',
      tokenTarjeta: 'tok_1',
      aceptaciones: { terminos: 'acc_1', datosPersonales: 'acc_2' },
    }),
    (e: unknown) => e instanceof CreacionTransaccionError && e.tipo === 'metodo_no_habilitado',
  );
});

test('tipo "firma_invalida" → lanza CreacionTransaccionError con ese tipo', async () => {
  stubFetch(502, { tipo: 'firma_invalida', error: 'No pudimos procesar tu pago. Intenta de nuevo o usa otro método.' });
  await assert.rejects(
    () => confirmarTransaccionTarjeta({
      reference: 'CN-1:abc',
      tokenTarjeta: 'tok_1',
      aceptaciones: { terminos: 'acc_1', datosPersonales: 'acc_2' },
    }),
    (e: unknown) => e instanceof CreacionTransaccionError && e.tipo === 'firma_invalida',
  );
});

test('tipo "otro_fallo" (o cualquier respuesta sin tipo reconocido) → cae a "otro_fallo"', async () => {
  stubFetch(404, { error: 'No encontramos el pedido al que corresponde este pago.' });
  await assert.rejects(
    () => confirmarTransaccionTarjeta({
      reference: 'CN-1:abc',
      tokenTarjeta: 'tok_1',
      aceptaciones: { terminos: 'acc_1', datosPersonales: 'acc_2' },
    }),
    (e: unknown) => e instanceof CreacionTransaccionError && e.tipo === 'otro_fallo' && e.message.includes('No encontramos'),
  );
});

test('el mensaje del servidor viaja tal cual — no se reemplaza por el genérico', async () => {
  stubFetch(502, { tipo: 'metodo_no_habilitado', error: 'Wompi rechazó el método CARD para esta cuenta.' });
  await assert.rejects(
    () => confirmarTransaccionTarjeta({
      reference: 'CN-1:abc',
      tokenTarjeta: 'tok_1',
      aceptaciones: { terminos: 'acc_1', datosPersonales: 'acc_2' },
    }),
    (e: unknown) => e instanceof CreacionTransaccionError && e.message === 'Wompi rechazó el método CARD para esta cuenta.',
  );
});
