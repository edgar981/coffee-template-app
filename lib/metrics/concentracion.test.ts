import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  concentracionIngresos, MIN_CLIENTES_CONCENTRACION, TOP_CONCENTRACION,
  RATIO_CONCENTRADO, RATIO_REPARTIDO,
  type ClienteIngreso,
} from './concentracion';
import { MIN_ORDENES_INSIGHT } from './insights';

// La guarda de muestra es lo que separa este número de una alarma inventada: con
// cinco clientes el top-5 es el 100% por aritmética, no por concentración.

const cliente = (id: string, total: number): ClienteIngreso =>
  ({ id, nombre: `Cliente ${id}`, total, ordenes: 1 });

const nClientes = (n: number, total = 10_000) =>
  Array.from({ length: n }, (_, i) => cliente(`c${i}`, total));

test('reparte el % del top sobre el total', () => {
  // Este fixture usaba 10 clientes y dejó de emitir % al subir el piso a 15. No es
  // que el test se rompiera: es que 10 clientes ya NO sostienen la afirmación, que
  // es exactamente el cambio. Se sube a 20 para seguir afirmando el REPARTO, que es
  // lo que este caso mide — la guarda tiene sus propios tests abajo.
  const r = concentracionIngresos([
    ...nClientes(5, 100_000),                                   // top 5 = 500.000
    ...nClientes(15, 100_000).map((c, i) => cliente(`x${i}`, 100_000)),
  ]);
  assert.equal(r.total, 2_000_000);
  assert.equal(r.totalTop, 500_000);
  assert.equal(r.pct, 25);
});

test('devuelve los N primeros, ordenados por dinero pagado desc', () => {
  const r = concentracionIngresos([
    cliente('a', 10_000), cliente('b', 90_000), cliente('c', 50_000),
    cliente('d', 20_000), cliente('e', 30_000), cliente('f', 40_000),
  ]);
  assert.equal(r.top.length, TOP_CONCENTRACION);
  assert.deepEqual(r.top.map(c => c.id), ['b', 'c', 'f', 'e', 'd']);
});

test('con muestra insuficiente el % es null — la lista se muestra igual', () => {
  // EL caso que motiva la guarda: 5 clientes dan 100% por construcción, y ese
  // 100% se lee como "todo depende de cinco personas" cuando solo dice que el
  // negocio tiene cinco clientes.
  const r = concentracionIngresos(nClientes(TOP_CONCENTRACION, 100_000));
  assert.equal(r.pct, null);
  assert.equal(r.top.length, TOP_CONCENTRACION);   // la lista SÍ se muestra
  assert.equal(r.totalTop, 500_000);
});

test('justo en el piso de muestra el % ya se emite', () => {
  const r = concentracionIngresos(nClientes(MIN_CLIENTES_CONCENTRACION, 100_000));
  assert.notEqual(r.pct, null);
});

test('los clientes SIN pagos no cuentan para la muestra ni diluyen el %', () => {
  // Importar una lista de contactos no puede "mejorar" la concentración sin que
  // entre un solo peso.
  const conCeros = [...nClientes(TOP_CONCENTRACION, 100_000), ...nClientes(50, 0)];
  const r = concentracionIngresos(conCeros);
  assert.equal(r.clientes, TOP_CONCENTRACION);
  assert.equal(r.pct, null);           // sigue sin base pese a los 55 registros
  assert.equal(r.total, 500_000);
});

test('sin clientes: cero, null y lista vacía', () => {
  const r = concentracionIngresos([]);
  assert.deepEqual(r.top, []);
  assert.equal(r.total, 0);
  assert.equal(r.pct, null);
  assert.equal(r.clientes, 0);
});

test('empate en dinero: orden estable por nombre', () => {
  const r = concentracionIngresos([
    { id: 'z', nombre: 'Zulma', total: 10_000, ordenes: 1 },
    { id: 'a', nombre: 'Ana',   total: 10_000, ordenes: 1 },
  ]);
  assert.deepEqual(r.top.map(c => c.nombre), ['Ana', 'Zulma']);
});

test('un solo cliente con toda la plata: 100% pero sin base → null', () => {
  const r = concentracionIngresos([cliente('a', 999_000)]);
  assert.equal(r.pct, null);
  assert.equal(r.totalTop, 999_000);
});

// ─── El piso, y las bandas ────────────────────────────────────────────────────

test('EL PISO ES EL MISMO NÚMERO DE MUESTRA QUE EL RESTO DE LA PÁGINA', () => {
  // No es un 15 tecleado: es `MIN_ORDENES_INSIGHT`. Se afirma la IDENTIDAD y no el
  // valor, para que mover uno mueva el otro — dos números de "muestra suficiente"
  // parecidos es cómo alguien recuerda mal cuál es cuál.
  assert.equal(MIN_CLIENTES_CONCENTRACION, MIN_ORDENES_INSIGHT);
});

test('el piso viejo (top+1) ya NO alcanza: era aritmética con forma de hallazgo', () => {
  // Con 6 clientes el top-5 es cinco sextos del padrón. El piso anterior era
  // exactamente ese 6, así que dejaba pasar el caso casi-degenerado.
  const r = concentracionIngresos(nClientes(TOP_CONCENTRACION + 1, 100_000));
  assert.equal(r.pct, null, 'seis clientes no sostienen una afirmación sobre el top-5');
  assert.equal(r.banda, null);
});

test('reparto PAREJO en el piso → repartido: el top-5 no supera su parte', () => {
  // 15 clientes iguales: el top-5 es 5/15 = 33,3% del dinero y 33,3% del padrón.
  // Ratio 1,0 — el suelo exacto de la escala.
  const r = concentracionIngresos(nClientes(MIN_CLIENTES_CONCENTRACION, 10_000));
  assert.ok(r.pct !== null);
  assert.ok(Math.abs(r.pct! - 100 * 5 / 15) < 0.01);
  assert.equal(r.banda, 'repartido');
});

test('el top-5 con la MITAD del dinero en el piso → concentrado', () => {
  // 5 clientes con 100.000 y 10 con 10.000: top-5 = 500k de 600k = 83,3%.
  // Proporcional 33,3% → ratio 2,5 ≥ 1,5.
  const r = concentracionIngresos([...nClientes(5, 100_000), ...nClientes(10, 10_000)]);
  assert.equal(r.clientes, 15);
  assert.equal(r.banda, 'concentrado');
});

test('LA BANDA ES RELATIVA, NO ABSOLUTA: el mismo % cae distinto según el padrón', () => {
  // ES EL PUNTO DE TODA LA REGLA, y por eso se afirma con el MISMO porcentaje en
  // dos padrones. Un umbral absoluto ("≥70% es concentrado") diría lo mismo en los
  // dos casos, y sería falso en uno: en un padrón chico ese % lo produce el tamaño
  // del propio grupo, no su peso.
  //
  // Padrón 15 (proporcional 33%): un ~71% es ratio 2,1 → concentrado.
  const chico = concentracionIngresos([
    ...nClientes(5, 100_000),          // 500.000
    ...nClientes(10, 20_000),          // 200.000 → total 700.000, top ≈ 71,4%
  ]);
  assert.ok(Math.abs(chico.pct! - 71.43) < 0.1);
  assert.equal(chico.banda, 'concentrado');

  // Padrón 50 (proporcional 10%): el mismo ~71% sería ratio 7,1 — más concentrado
  // todavía. Lo que cambia el veredicto es el padrón, no el número.
  const grande = concentracionIngresos([
    ...nClientes(5, 100_000),
    ...nClientes(45, 4_444),           // ≈ 200.000 → top ≈ 71,4% otra vez
  ]);
  assert.ok(Math.abs(grande.pct! - 71.4) < 0.5);
  assert.equal(grande.banda, 'concentrado');
});

test('la banda del MEDIO existe y no adjetiva', () => {
  // Ratio entre 1,1 y 1,5: hay muestra, pero el top-5 no supera lo suficiente su
  // parte como para nombrar el hecho. Se calla, con el precedente de `insightEnBanda`.
  // 5 × 30.000 = 150.000 de 350.000 = 42,9%; proporcional 33,3% → ratio 1,29.
  const r = concentracionIngresos([...nClientes(5, 30_000), ...nClientes(10, 20_000)]);
  const proporcional = 100 * 5 / 15;
  const ratio = r.pct! / proporcional;
  assert.ok(ratio > RATIO_REPARTIDO && ratio < RATIO_CONCENTRADO, `ratio fuera de la banda: ${ratio}`);
  assert.equal(r.banda, null);
});

test('sin muestra no hay banda, aunque el reparto sea extremo', () => {
  // La guarda de muestra MANDA sobre la caracterización: sin base, ni el hecho ni
  // su adjetivo. Un "están concentrados" con 3 clientes sería la alarma inventada
  // que el piso existe para impedir.
  const r = concentracionIngresos([cliente('a', 1_000_000), cliente('b', 1_000), cliente('c', 1_000)]);
  assert.equal(r.pct, null);
  assert.equal(r.banda, null);
});
