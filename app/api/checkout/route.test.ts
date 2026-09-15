import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST, checkoutSchema } from './route';
import { pasarelaDisponibleEnEsteDespliegue } from '@/services/checkout.service';

// NOTA DE ALCANCE (§ WOMPI-WIDGET-EN-EL-CANONICO-1): este archivo, como su gemelo
// `app/api/webhooks/wompi/route.test.ts`, vive FUERA de los globs de `npm test`
// (`lib/**`, `constants/**`, `packages/core/**`) y de `npm run test:integracion`
// (`tests/integracion/**`) — medido en `package.json:14` y
// `scripts/test-integracion.sh:89`. `npm run gate` NO lo corre. Se escribe igual,
// siguiendo el precedente ya aceptado, y se corre a mano con
// `node --import tsx --test app/api/checkout/route.test.ts`. El hueco es sistémico
// (compartido con el webhook), no de este slice — ver el reporte del slice.
//
// Las pruebas de `POST` se restringen a las DOS ramas que responden ANTES de tocar
// `resolveOrderLines`/`createOrderWithCustomer` (Prisma real) — no hay DB efímera acá.
// El resto de la forma (la unión `metodo`/`pasarela`) se afirma parseando `checkoutSchema`
// directamente, sin invocar la ruta.

function shippingBase(overrides: Record<string, unknown> = {}) {
  return { direccion: 'Calle 1 # 2-3', ciudad: 'Medellín', departamento: 'Antioquia', ...overrides };
}

function payloadBase(overrides: Record<string, unknown> = {}) {
  return {
    customer: { nombre: 'Test', apellido: 'Uno', email: 'test@example.com', telefono: '+573001234567' },
    shipping: shippingBase(),
    payment:  { pasarela: true },
    items:    [{ slug: 'cafe-test', cantidad: 1 }],
    ...overrides,
  };
}

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/checkout', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

test('pasarelaDisponibleEnEsteDespliegue(): la capacidad nace APAGADA — (d) todavía no existe', () => {
  assert.equal(pasarelaDisponibleEnEsteDespliegue(), false);
});

test('checkoutSchema: `payment.metodo` (el set cerrado de siempre) sigue aceptándose byte-idéntico', () => {
  const parsed = checkoutSchema.safeParse(payloadBase({ payment: { metodo: 'nequi', referencia: 'abc' } }));
  assert.equal(parsed.success, true);
});

test('checkoutSchema: `payment.pasarela: true` (el camino nuevo) se acepta', () => {
  const parsed = checkoutSchema.safeParse(payloadBase({ payment: { pasarela: true } }));
  assert.equal(parsed.success, true);
});

test('checkoutSchema: `payment` sin `metodo` NI `pasarela` se rechaza — no hay un tercer camino implícito', () => {
  const parsed = checkoutSchema.safeParse(payloadBase({ payment: { algoQueNoEsNiUnoNiOtro: true } }));
  assert.equal(parsed.success, false);
});

test('checkoutSchema: `pasarela: false` se rechaza — el discriminador es el LITERAL `true`, no cualquier booleano', () => {
  const parsed = checkoutSchema.safeParse(payloadBase({ payment: { pasarela: false } }));
  assert.equal(parsed.success, false);
});

test('POST: `payment.pasarela: true` sin (d) → 400, ANTES de tocar la base (sin resolveOrderLines/createOrderWithCustomer)', async () => {
  const res = await POST(postRequest(payloadBase()));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /no está disponible/i);
});

test('POST: el 400 de disponibilidad ocurre ANTES que el de franja horaria (Bogotá, sin franja) — no es un rechazo de forma', async () => {
  // Si esta guarda se moviera DESPUÉS de la validación de franja, una orden de pasarela hacia
  // Bogotá sin franja devolvería el error de franja en vez del de disponibilidad — dos causas
  // posibles para el mismo 400, indistinguibles para quien depure. Se fija el ORDEN con un
  // caso que dispararía LA OTRA guarda si el orden se invirtiera (Bogotá D.C. sin `franja`).
  const res = await POST(postRequest(payloadBase({
    shipping: shippingBase({ ciudad: 'Bogotá', departamento: 'Bogotá D.C.' }),
  })));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /no está disponible/i);
});
