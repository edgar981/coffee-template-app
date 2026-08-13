import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTROS_PEDIDOS, filtroPorKey, aplicarFiltro, conteos, filtrarPorCliente,
  filtrarPorRango, filtrarPorEstado, parseEstados, soloOrdenesReales, aplicarAlcance, hayAlcance,
  type OrdenParaFiltro,
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

test('"Todos" EXCLUYE las canceladas — la misma definición de orden contable del repo', () => {
  // Antes este carril no filtraba nada, y con eso tenía una SEGUNDA opinión sobre
  // qué orden cuenta: `isCountableOrder` (Clientes, recurrentes, "Órdenes del
  // mes") dice que una cancelada no cuenta. Que difirieran es lo que obligaba al
  // widget del mes a enumerar estados en su enlace para no contar de más.
  assert.deepEqual(aplicarFiltro(TODAS, 'todos'), TODAS.filter(x => x !== cancelada));
  assert.ok(!aplicarFiltro(TODAS, 'todos').includes(cancelada));
  // Y no desaparecen del panel: tienen su carril, que es su destino.
  assert.deepEqual(aplicarFiltro(TODAS, 'cancelado'), [cancelada]);
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
  assert.equal(c.todos, 6);   // las siete menos la cancelada
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

// ─── EL RANGO DE FECHAS ──────────────────────────────────────────────────────
//
// Las fechas se eligen para probar la ZONA HORARIA, no sólo el corte: Bogotá es
// UTC-5, así que un instante UTC de la madrugada pertenece al día ANTERIOR en el
// reloj del negocio. Un filtro que se apoyara en la zona del navegador daría otro
// día en un portátil en Madrid, y el número del widget dejaría de cuadrar.

const enDia = (iso: string) => o({ createdAt: iso, shipping: { estado: 'preparando' } });

// 2026-08-10T03:00Z = 2026-08-09 22:00 en Bogotá → cuenta como el DÍA 9.
const madrugadaUTC = enDia('2026-08-10T03:00:00.000Z');
const dia10        = enDia('2026-08-10T17:00:00.000Z');
const dia12        = enDia('2026-08-12T17:00:00.000Z');
const dia20        = enDia('2026-08-20T17:00:00.000Z');
const EN_FECHAS = [madrugadaUTC, dia10, dia12, dia20];

test('el rango es INCLUSIVO por los dos extremos', () => {
  assert.deepEqual(filtrarPorRango(EN_FECHAS, '2026-08-10', '2026-08-12'), [dia10, dia12]);
  assert.deepEqual(filtrarPorRango(EN_FECHAS, '2026-08-12', '2026-08-12'), [dia12]);
});

test('la madrugada UTC cae en el día de BOGOTÁ, no en el de UTC', () => {
  // 03:00Z del día 10 son las 22:00 del día 9 en Bogotá. Si esto se rompe, el
  // widget "Pedidos de hoy" y la lista dejan de cuadrar durante cinco horas cada
  // noche — el peor momento posible, porque nadie está mirando.
  assert.deepEqual(filtrarPorRango(EN_FECHAS, '2026-08-09', '2026-08-09'), [madrugadaUTC]);
  assert.ok(!filtrarPorRango(EN_FECHAS, '2026-08-10', '2026-08-10').includes(madrugadaUTC));
});

test('cada extremo es INDEPENDIENTE — los buckets de cartera usan las dos formas abiertas', () => {
  assert.deepEqual(filtrarPorRango(EN_FECHAS, '2026-08-12', null), [dia12, dia20]);
  assert.deepEqual(filtrarPorRango(EN_FECHAS, null, '2026-08-10'), [madrugadaUTC, dia10]);
});

test('sin rango NO filtra; una orden sin fecha nunca entra a un rango', () => {
  assert.equal(filtrarPorRango(EN_FECHAS, null, null).length, 4);
  const sinFecha = o({ shipping: { estado: 'preparando' } });
  assert.deepEqual(filtrarPorRango([sinFecha], '2026-01-01', '2030-01-01'), []);
  // Pero sin rango sigue estando: la ausencia de fecha no la esconde del panel.
  assert.deepEqual(filtrarPorRango([sinFecha], null, null), [sinFecha]);
});

// ─── EL ALCANCE DE COBRO ─────────────────────────────────────────────────────

test('`estado` acota por cobro, y la lista vacía NO es "ninguno"', () => {
  assert.deepEqual(filtrarPorEstado(TODAS, ['cancelado']), [cancelada]);
  assert.equal(filtrarPorEstado(TODAS, []).length, TODAS.length);
});

test('`parseEstados` descarta los tokens basura sin invalidar el parámetro', () => {
  // Misma tolerancia que la pantalla vieja: `?estado=pendiente,basura` sigue
  // acotando a pendiente en vez de ignorarse entero.
  assert.deepEqual(parseEstados('pendiente,basura'), ['pendiente']);
  assert.deepEqual(parseEstados('pendiente,pagado'), ['pendiente', 'pagado']);
  assert.deepEqual(parseEstados('pagado,pagado'), ['pagado']);      // sin duplicados
  assert.deepEqual(parseEstados(' pendiente '), ['pendiente']);
  assert.deepEqual(parseEstados(null), []);
  assert.deepEqual(parseEstados('basura'), []);
});

// ─── LAS `SN-` NO SON PEDIDOS ────────────────────────────────────────────────

test('las `SN-` de demo quedan fuera; las `CN-` del seed NO', () => {
  const real   = o({ numero_orden: 'CN-132453' });
  const demo   = o({ numero_orden: 'SN-D001' });
  // El seed crea ADEMÁS ~90 días de `CN-9#####` para que la gráfica funcione: son
  // de la serie real y se quedan. Excluir `SN-` no vacía la pantalla en dev.
  const semilla = o({ numero_orden: 'CN-900042' });
  assert.deepEqual(soloOrdenesReales([real, demo, semilla]), [real, semilla]);
});

test('una orden SIN número no se descarta', () => {
  // No consta que sea demo, y esconderla sería peor que mostrarla.
  const anonima = o({});
  assert.deepEqual(soloOrdenesReales([anonima]), [anonima]);
});

// ─── LOS TRES ALCANCES SE COMPONEN ───────────────────────────────────────────

test('rango + cliente + cobro se intersecan, y el carril va encima', () => {
  const a = o({ cliente_id: 'c1', estado: 'pendiente', createdAt: '2026-08-10T17:00:00.000Z', shipping: { estado: 'preparando' } });
  const b = o({ cliente_id: 'c1', estado: 'pagado',    createdAt: '2026-08-10T17:00:00.000Z', shipping: { estado: 'preparando' } });
  const c = o({ cliente_id: 'c2', estado: 'pendiente', createdAt: '2026-08-10T17:00:00.000Z', shipping: { estado: 'preparando' } });
  const d = o({ cliente_id: 'c1', estado: 'pendiente', createdAt: '2026-08-20T17:00:00.000Z', shipping: { estado: 'preparando' } });
  const LISTA = [a, b, c, d];

  const alcance = aplicarAlcance(LISTA, {
    cliente: 'c1', desde: '2026-08-10', hasta: '2026-08-12', estados: ['pendiente'],
  });
  assert.deepEqual(alcance, [a]);
  // Y el carril sigue componiéndose encima, que es lo que hace posible
  // "En preparación de esta semana".
  assert.deepEqual(aplicarFiltro(alcance, 'preparacion'), [a]);
});

test('los CONTEOS respetan el rango activo', () => {
  // Es la mitad que el gate mira: el pill tiene que contar sobre lo que hay
  // debajo, no sobre la tienda entera.
  const sinAlcance = conteos(EN_FECHAS);
  const enRango    = conteos(filtrarPorRango(EN_FECHAS, '2026-08-10', '2026-08-12'));
  assert.equal(sinAlcance.todos, 4);
  assert.equal(enRango.todos, 2);
  assert.equal(enRango.preparacion, 2);
});

test('`hayAlcance` ve cualquiera de los tres', () => {
  const vacio = { cliente: null, desde: null, hasta: null, estados: [] };
  assert.equal(hayAlcance(vacio), false);
  assert.equal(hayAlcance({ ...vacio, cliente: 'c1' }), true);
  assert.equal(hayAlcance({ ...vacio, desde: '2026-08-10' }), true);
  assert.equal(hayAlcance({ ...vacio, hasta: '2026-08-10' }), true);
  assert.equal(hayAlcance({ ...vacio, estados: ['pendiente'] }), true);
});
