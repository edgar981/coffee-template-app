import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTROS_PEDIDOS, filtroPorKey, aplicarFiltro, conteos, type OrdenParaFiltro,
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
