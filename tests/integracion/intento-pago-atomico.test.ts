import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderWithCustomer, referenciaIntentoPago } from '@duna/core/orders';
import { MetodoPago } from '@duna/core';
import { buildBrand } from '@/lib/config/brand';
import { prisma, limpiar } from './fixtures';

// EL `PaymentIntent` NACE EN DOS ESCRITURAS DENTRO DE LA MISMA TRANSACCIÓN QUE LA
// ORDEN, Y ESO NUNCA ES OBSERVABLE DESDE AFUERA — no por comentario, por PROPIEDAD.
//
// `reference` embebe el `id` de la propia fila (packages/core/src/orders.ts,
// WOMPI-CREADOR-DE-INTENTOS-1), y Prisma sólo entrega ese id DESPUÉS del insert.
// Por eso el intento nace con un placeholder (`_pendiente_<uuid>`) y se pisa con la
// referencia real en el mismo `tx`. El owner lo aceptó por UNA razón, textual:
// "es seguro por UNA propiedad: las dos viven en la misma transacción, así que
// nunca es observable". Si esa propiedad se pierde —si alguien mueve la creación
// del intento FUERA del `$transaction`— y el proceso muere entre las dos
// escrituras, sobrevive una fila con la referencia placeholder. El reconciliador
// le preguntaría a Wompi por una referencia que NUNCA EXISTIÓ, y Wompi responde
// `200 {"data":[]}` — indistinguible de "todavía no se creó". El intento quedaría
// vivo hasta que el barrido lo cierre a las 48 h. Un comentario no evita eso; un
// test sí, y es éste.
//
// POR QUÉ VA EN EL CARRIL DE INTEGRACIÓN Y NO EN CAPA 1: `createOrderWithCustomer`
// importa `prisma` a nivel de módulo (sin inyección posible) y lo que se afirma acá
// es la propiedad de un `$transaction` real contra Postgres — un mock de Prisma
// jamás podría fingir un rollback verdadero. Mismo criterio que `ajuste-concurrente`
// y `despacho-concurrente`: la concurrencia/atomicidad se prueba con una base real
// o no se prueba.
//
// ADVERTENCIA DE ALCANCE — ESTE ARCHIVO NO CORRE EN `npm test`. Vive en
// `tests/integracion/`, que sólo ejecuta `npm run test:integracion` (Postgres
// efímero, scripts/test-integracion.sh). El gate normal (`npm test`, capa 1) no lo
// toca. Para que corriera donde el gate normal lo vea, `test:integracion` tendría
// que sumarse al pipeline de CI/pre-merge — hoy es un carril MANUAL, aparte, con su
// propio prerequisito (Postgres local instalado). Se nombra acá para no repetir en
// silencio lo que ya costó una vez esta semana (un test fuera de un glob).

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

const base = {
  canal: 'directo' as const,
  total: 28_000,
  items: [{ producto_nombre: 'Café', cantidad: 1, subtotal: 28_000 }],
};

test('ATOMICIDAD: si la transacción falla DESPUÉS de escribir el intento, no sobrevive ni la orden ni el PaymentIntent', async () => {
  // Forzamos el fallo DENTRO de la misma transacción, DESPUÉS de que el intento ya
  // tuvo sus dos escrituras (placeholder → referencia real): `crearIntentoPago` crea
  // el `PaymentIntent` primero, e `immediatePayment` corre después
  // (`registerOrderPaymentTx` dentro del mismo `tx`, ver orders.ts). Un `metodo` que
  // no existe en el enum `MetodoPago` hace que `tx.payment.create` reviente — sin
  // tocar una sola línea de `orders.ts`, sólo pasando por su superficie pública un
  // valor que el compilador rechazaría si no lo forzáramos con `as MetodoPago`.
  const brand = await buildBrand();
  await assert.rejects(() =>
    createOrderWithCustomer({
      ...base,
      customer: { nombre: 'Falla Atómica', telefono: '3009990001' },
      brand,
      crearIntentoPago: true,
      immediatePayment: { metodo: 'NO_EXISTE_EN_EL_ENUM' as MetodoPago },
    }),
  );

  // Ninguna fila de NINGUNA de las dos tablas sobrevive — la prueba directa de que
  // el intento nació y murió DENTRO de la misma transacción que la orden.
  assert.equal(await prisma.order.count(), 0, 'la orden no debía sobrevivir al rollback');
  assert.equal(await prisma.paymentIntent.count(), 0, 'el intento no debía sobrevivir al rollback');
});

test('tras un alta exitosa, ninguna fila de PaymentIntent (en TODA la tabla) se queda con su referencia placeholder', async () => {
  // Tres altas con `crearIntentoPago`, para que el barrido final no sea "revisar
  // una fila" sino un barrido de verdad — la propiedad que importa es que NINGUNA
  // fila de la tabla, no sólo la de esta orden, se quede a medio camino. Secuencial
  // (no Promise.all): cada alta abre su propia transacción y no hay nada que ganar
  // corriéndolas en paralelo acá.
  const brand = await buildBrand();
  for (let n = 1; n <= 3; n++) {
    await createOrderWithCustomer({
      ...base,
      customer: { nombre: `Compra ${n}`, telefono: `300111000${n}` },
      brand,
      crearIntentoPago: true,
    });
  }

  const todos = await prisma.paymentIntent.findMany({
    include: { order: { select: { numero_orden: true } } },
  });
  assert.equal(todos.length, 3, 'las tres altas debían dejar un intento cada una');

  for (const fila of todos) {
    // La FORMA final, no el literal del placeholder (que no vive exportado en
    // ningún lado — ver el asiento de este slice en DECISIONS.md): si la fila se
    // hubiera quedado en `_pendiente_<uuid>`, esta igualdad fallaría, porque esa
    // cadena nunca puede coincidir con `<numero_orden>:<id>`. Afirmar la forma
    // final barre el mismo hueco sin duplicar un literal que puede cambiar.
    assert.equal(
      fila.reference,
      referenciaIntentoPago(fila.order.numero_orden, fila.id),
      `PaymentIntent ${fila.id} no quedó con su referencia final — sospecha de placeholder sobreviviente`,
    );
  }
});
