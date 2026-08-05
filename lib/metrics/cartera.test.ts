import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparCartera, bucketPorEdad, dayKeyMas, queryDelBucket,
  CARTERA_DIAS_RECIENTE, CARTERA_DIAS_MEDIO,
} from './cartera';

// El valor de estas pruebas está en la FRONTERA entre los buckets y en que el
// deep link la reproduzca exactamente. Un bucket que dice "3 órdenes" y una lista
// que muestra 4 no es un error de redondeo: es el invariante card=lista roto, y
// es lo que hace que el operador deje de creerle a la página.

const HOY = '2026-08-05';

test('los cortes son inclusivos por arriba', () => {
  assert.equal(bucketPorEdad(0), 'reciente');
  assert.equal(bucketPorEdad(CARTERA_DIAS_RECIENTE), 'reciente');       // 7
  assert.equal(bucketPorEdad(CARTERA_DIAS_RECIENTE + 1), 'medio');      // 8
  assert.equal(bucketPorEdad(CARTERA_DIAS_MEDIO), 'medio');             // 15
  assert.equal(bucketPorEdad(CARTERA_DIAS_MEDIO + 1), 'vencido');       // 16
});

test('una edad negativa (reloj desfasado) cae en reciente, no en vencido', () => {
  assert.equal(bucketPorEdad(-1), 'reciente');
});

test('EL invariante: el rango del query de cada bucket contiene exactamente sus edades', () => {
  // Se recorre día por día y se verifica que la orden creada ese día caiga
  // dentro de los límites `desde`/`hasta` del bucket que le corresponde. Esto es
  // lo que prueba que el link no miente — el resto son detalles.
  for (let edad = 0; edad <= 40; edad++) {
    const creada = dayKeyMas(HOY, -edad);
    const bucket = bucketPorEdad(edad);
    const params = new URLSearchParams(queryDelBucket(bucket, HOY));

    assert.equal(params.get('estado'), 'pendiente', `edad ${edad}: falta el estado`);
    const desde = params.get('desde');
    const hasta = params.get('hasta');
    // Los filtros de Órdenes comparan day keys como strings (YYYY-MM-DD ordena
    // lexicográficamente), así que la aserción usa la MISMA comparación.
    assert.ok(!desde || creada >= desde, `edad ${edad} quedaría fuera por desde=${desde}`);
    assert.ok(!hasta || creada <= hasta, `edad ${edad} quedaría fuera por hasta=${hasta}`);
  }
});

test('los rangos de los buckets no se solapan ni dejan huecos', () => {
  const reciente = new URLSearchParams(queryDelBucket('reciente', HOY));
  const medio    = new URLSearchParams(queryDelBucket('medio', HOY));
  const vencido  = new URLSearchParams(queryDelBucket('vencido', HOY));

  // El `hasta` de medio es el día anterior al `desde` de reciente: pegados, sin
  // un día que caiga en los dos o en ninguno.
  assert.equal(dayKeyMas(medio.get('hasta')!, 1), reciente.get('desde'));
  assert.equal(dayKeyMas(vencido.get('hasta')!, 1), medio.get('desde'));
  // Los extremos son abiertos: reciente no tiene `hasta` (nada es más nuevo que
  // hoy) y vencido no tiene `desde` (no hay piso de antigüedad).
  assert.equal(reciente.get('hasta'), null);
  assert.equal(vencido.get('desde'), null);
});

test('agrupa conteo y monto por bucket', () => {
  const r = agruparCartera([
    { dia: dayKeyMas(HOY, -1),  total: 50_000 },
    { dia: dayKeyMas(HOY, -7),  total: 30_000 },
    { dia: dayKeyMas(HOY, -8),  total: 20_000 },
    { dia: dayKeyMas(HOY, -30), total: 10_000 },
  ], HOY);

  assert.equal(r.conteo, 4);
  assert.equal(r.total, 110_000);
  assert.deepEqual(
    r.buckets.map(b => [b.bucket, b.conteo, b.monto]),
    [['reciente', 2, 80_000], ['medio', 1, 20_000], ['vencido', 1, 10_000]],
  );
});

test('los TRES buckets se devuelven aunque estén vacíos', () => {
  // Un bucket que desaparece al vaciarse mueve al de al lado, y el operador
  // aprende la posición de "vencido" antes que su etiqueta.
  const r = agruparCartera([{ dia: HOY, total: 1_000 }], HOY);
  assert.deepEqual(r.buckets.map(b => b.bucket), ['reciente', 'medio', 'vencido']);
  assert.equal(r.buckets[2].conteo, 0);
});

test('cartera vacía: total y conteo en cero, buckets presentes', () => {
  const r = agruparCartera([], HOY);
  assert.equal(r.total, 0);
  assert.equal(r.conteo, 0);
  assert.equal(r.buckets.length, 3);
});

test('las etiquetas se DERIVAN de las constantes, no se teclean', () => {
  const r = agruparCartera([], HOY);
  assert.equal(r.buckets[0].label, `0–${CARTERA_DIAS_RECIENTE} días`);
  assert.equal(r.buckets[1].label, `${CARTERA_DIAS_RECIENTE + 1}–${CARTERA_DIAS_MEDIO} días`);
  assert.equal(r.buckets[2].label, `Más de ${CARTERA_DIAS_MEDIO} días`);
});

test('dayKeyMas cruza fin de mes y de año', () => {
  assert.equal(dayKeyMas('2026-03-01', -1),  '2026-02-28');
  assert.equal(dayKeyMas('2026-01-01', -1),  '2025-12-31');
  assert.equal(dayKeyMas('2024-03-01', -1),  '2024-02-29'); // bisiesto
});
