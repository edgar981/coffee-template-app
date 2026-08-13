import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTROS_PEDIDOS, filtroPorKey, aplicarFiltro, conteos, filtrarPorCliente, type OrdenParaFiltro,
} from './filtros';

const o = (x: Partial<OrdenParaFiltro> = {}): OrdenParaFiltro => ({
  estado: 'pendiente', condicion_pago: 'ANTICIPADO', ...x,
});

const nueva      = o();
const preparando = o({ shipping: { estado: 'preparando' } });
const aMedias    = o({ shipping: { estado: 'preparando', mensajero: 'Luis' } });
const enRuta     = o({ estado: 'pagado', shipping: { estado: 'en_ruta' } });
const porCobrar  = o({ condicion_pago: 'CONTRAENTREGA', shipping: { estado: 'en_ruta' } });
const entregada  = o({ estado: 'pagado', shipping: { estado: 'entregado' } });
const cancelada  = o({ estado: 'cancelado', shipping: { estado: 'cancelado' } });
const TODAS = [nueva, preparando, aMedias, enRuta, porCobrar, entregada, cancelada];

test('los SIETE carriles, y el conjunto es la decisión', () => {
  assert.deepEqual(
    FILTROS_PEDIDOS.map(f => f.label),
    ['Todos', 'Necesitan atención', 'En preparación', 'En camino', 'Entregados', 'Por cobrar', 'Cancelado'],
  );
  // El cobro dejó de ser un carril por el que se entra y pasó a ser una propiedad
  // que se VE en cada fila. Los dos que quedan del eje de plata son carriles de
  // TRABAJO, no estados: hay que ir a cobrar, o el pedido está muerto.
  assert.ok(!FILTROS_PEDIDOS.some(f => ['Pendiente', 'Pagado'].includes(f.label)));
});

test('"Todos" NO filtra — y eso es distinto de filtrar y no encontrar nada', () => {
  assert.equal(FILTROS_PEDIDOS[0].aplica, undefined);
  assert.equal(aplicarFiltro(TODAS, 'todos').length, TODAS.length);
});

test('cada carril recoge lo suyo', () => {
  assert.deepEqual(aplicarFiltro(TODAS, 'preparacion'), [preparando, aMedias]);
  assert.deepEqual(aplicarFiltro(TODAS, 'camino'), [enRuta, porCobrar]);
  assert.deepEqual(aplicarFiltro(TODAS, 'entregados'), [entregada]);
  assert.deepEqual(aplicarFiltro(TODAS, 'por_cobrar'), [porCobrar]);
  assert.deepEqual(aplicarFiltro(TODAS, 'cancelado'), [cancelada]);
  // Atención = la unión de los cuatro predicados; acá disparan la programación a
  // medias y la plata en la calle.
  assert.deepEqual(aplicarFiltro(TODAS, 'atencion'), [aMedias, porCobrar]);
});

test('un pedido CANCELADO no aparece en ningún carril de fulfillment', () => {
  // Sale gratis —al cancelar, el envío pasa a `cancelado`— pero se afirma igual:
  // depender del efecto lateral de otra parte del sistema sin decirlo es cómo esto
  // se rompe callado el día que cancelar deje de tocar el envío.
  for (const key of ['preparacion', 'camino', 'entregados'] as const) {
    assert.ok(!aplicarFiltro(TODAS, key).includes(cancelada), `cancelada no va en "${key}"`);
  }
  assert.ok(!aplicarFiltro(TODAS, 'atencion').includes(cancelada), 'ni pide atención');
});

test('una key desconocida no se cae a "todos" en silencio', () => {
  assert.equal(filtroPorKey('inventado'), null);
  // `aplicarFiltro` con una key basura devuelve todo, pero quien resuelve la URL
  // usa `filtroPorKey` y puede distinguir "no hay filtro" de "el filtro no existe".
  assert.ok(filtroPorKey('todos'));
});

test('los conteos salen de la MISMA lista que se muestra', () => {
  const c = conteos(TODAS);
  assert.equal(c.todos, 7);
  assert.equal(c.atencion, 2);
  assert.equal(c.preparacion, 2);
  assert.equal(c.camino, 2);
  assert.equal(c.entregados, 1);
  assert.equal(c.por_cobrar, 1);
  assert.equal(c.cancelado, 1);
  // El invariante que hace útil el número: el conteo de un carril es exactamente
  // lo que ese carril muestra. Un contador que no cuadra con lo de abajo es peor
  // que ninguno.
  for (const f of FILTROS_PEDIDOS) {
    assert.equal(c[f.key], aplicarFiltro(TODAS, f.key).length, `el pill de "${f.label}" cuadra con su lista`);
  }
});

// ─── EL ALCANCE POR CLIENTE ──────────────────────────────────────────────────

const deC1 = o({ cliente_id: 'c1', shipping: { estado: 'preparando' } });
const deC1b = o({ cliente_id: 'c1', condicion_pago: 'CONTRAENTREGA', shipping: { estado: 'en_ruta' } });
const deC2 = o({ cliente_id: 'c2', shipping: { estado: 'preparando' } });
const huerfana = o({ cliente_id: null, shipping: { estado: 'preparando' } });
const DE_VARIOS = [deC1, deC1b, deC2, huerfana];

test('sin cliente NO filtra — distinto de "filtra y no matchea nada"', () => {
  assert.equal(filtrarPorCliente(DE_VARIOS, null).length, 4);
});

test('con cliente deja SÓLO los suyos, y la huérfana no entra', () => {
  // Una orden sin `cliente_id` no consta de quién es: no se le atribuye a nadie,
  // ni siquiera cuando es la única que queda.
  assert.deepEqual(filtrarPorCliente(DE_VARIOS, 'c1'), [deC1, deC1b]);
  assert.deepEqual(filtrarPorCliente(DE_VARIOS, 'c2'), [deC2]);
  assert.deepEqual(filtrarPorCliente(DE_VARIOS, 'nadie'), []);
});

test('el alcance se COMBINA con el carril, no lo reemplaza', () => {
  // Es la propiedad que hace que sea un alcance y no un octavo pill: entrar por el
  // sol de un cliente aterriza en "Necesitan atención" DE ESE cliente.
  const alcance = filtrarPorCliente(DE_VARIOS, 'c1');
  assert.deepEqual(aplicarFiltro(alcance, 'atencion'), [deC1b]);
  assert.deepEqual(aplicarFiltro(alcance, 'preparacion'), [deC1]);
});

test('los CONTEOS se calculan sobre el alcance, no sobre la lista entera', () => {
  // Un pill que dice 2 y al hacer clic muestra 1 es peor que ninguno.
  const todos   = conteos(DE_VARIOS);
  const soloC1  = conteos(filtrarPorCliente(DE_VARIOS, 'c1'));
  assert.equal(todos.todos, 4);
  assert.equal(soloC1.todos, 2);
  assert.equal(soloC1.atencion, 1);
  assert.equal(soloC1.preparacion, 1);
});
