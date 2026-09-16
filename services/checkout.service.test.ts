import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { pasarelaDisponibleEnEsteDespliegue } from './checkout.service';

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
