import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esOrigenNotificable, entregaVencidaSinCobro, corteEntregaISO, horasDesdeEntrega,
  HORAS_ENTREGA_SIN_COBRO,
} from './reglas';

// Las reglas de la campana se testean acá porque son las que deciden si el
// operador recibe un aviso o no lo recibe. Los dos modos de falla son caros y
// opuestos: avisar de más entrena a ignorar la campana entera; avisar de menos
// deja plata sin cobrar. Ninguno de los dos se ve en pantalla hasta que ya pasó.

// ─── Disparador 1: filtro de origen ──────────────────────────────────────────

test('las órdenes del storefront notifican', () => {
  assert.equal(esOrigenNotificable('storefront'), true);
});

test('las órdenes tecleadas en el admin NO notifican', () => {
  assert.equal(esOrigenNotificable('admin'), false);
});

test('el filtro es "todo lo que no es admin": un origen nuevo notifica de fábrica', () => {
  // El silencio tiene que ser la excepción EXPLÍCITA. Si esta regla se
  // reescribiera como `origen === 'storefront'`, un canal de entrada futuro (un
  // bot, un marketplace) entraría mudo y nadie se enteraría hasta perder ventas.
  assert.equal(esOrigenNotificable('bot-whatsapp' as 'storefront'), true);
});

// ─── Disparador 3: entregado sin cobrar ──────────────────────────────────────

const AHORA = new Date('2026-08-04T12:00:00.000Z');
/** ISO de hace `h` horas respecto a AHORA. */
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString();

test('no avisa antes del umbral', () => {
  assert.equal(entregaVencidaSinCobro({ fecha_entrega: haceHoras(23) }, 24, AHORA), false);
});

test('avisa justo al cumplirse el umbral y después', () => {
  assert.equal(entregaVencidaSinCobro({ fecha_entrega: haceHoras(24) }, 24, AHORA), true);
  assert.equal(entregaVencidaSinCobro({ fecha_entrega: haceHoras(25) }, 24, AHORA), true);
});

test('el umbral es configurable, no 24 fijo', () => {
  const entrega = { fecha_entrega: haceHoras(5) };
  assert.equal(entregaVencidaSinCobro(entrega, 4, AHORA), true);
  assert.equal(entregaVencidaSinCobro(entrega, 6, AHORA), false);
});

test('sin fecha de entrega NO avisa — no hay reloj que correr', () => {
  // El lado seguro del error es callar: un aviso fabricado sobre un dato roto
  // manda al operador a revisar una orden que quizá ya se cobró.
  assert.equal(entregaVencidaSinCobro({}, 24, AHORA), false);
  assert.equal(entregaVencidaSinCobro({ fecha_entrega: null }, 24, AHORA), false);
  assert.equal(entregaVencidaSinCobro({ fecha_entrega: '' }, 24, AHORA), false);
  assert.equal(entregaVencidaSinCobro({ fecha_entrega: 'ayer' }, 24, AHORA), false);
});

test('una entrega en el futuro (reloj torcido) no avisa', () => {
  assert.equal(entregaVencidaSinCobro({ fecha_entrega: haceHoras(-3) }, 24, AHORA), false);
});

test('el corte en DB y la decisión en JS coinciden en el borde', () => {
  // El `where` usa comparación lexicográfica sobre TEXTO; la decisión usa
  // Date.parse. Si divergieran, una orden vencida podría quedar fuera del lote y
  // no avisar nunca — un falso negativo silencioso, el peor de los dos.
  const corte = corteEntregaISO(24, AHORA);
  const justoVencida = haceHoras(24.5);
  const aunNo        = haceHoras(23.5);

  assert.ok(justoVencida < corte, 'la vencida entra al pre-filtro');
  assert.ok(!(aunNo < corte),     'la que no vence queda fuera del pre-filtro');
  assert.equal(entregaVencidaSinCobro({ fecha_entrega: justoVencida }, 24, AHORA), true);
  assert.equal(entregaVencidaSinCobro({ fecha_entrega: aunNo },        24, AHORA), false);
});

test('las horas del mensaje se truncan hacia abajo', () => {
  assert.equal(horasDesdeEntrega({ fecha_entrega: haceHoras(25.9) }, AHORA), 25);
  assert.equal(horasDesdeEntrega({ fecha_entrega: 'ayer' }, AHORA), null);
});

test('el default documentado es 24h', () => {
  assert.equal(HORAS_ENTREGA_SIN_COBRO, 24);
});
