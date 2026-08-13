import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pedidosPorAtenderPorCliente, type OrdenParaAtencionCliente } from './atencion';

const orden = (o: Partial<OrdenParaAtencionCliente> = {}): OrdenParaAtencionCliente => ({
  estado: 'pendiente', condicion_pago: 'ANTICIPADO', ...o,
});

// Los mismos cuatro motivos de `lib/pedidos/atencion`, acá con dueño. Se repiten
// A PROPÓSITO en vez de importarse: son la ENTRADA de esta función, y un cambio
// en la regla de allá tiene que verse acá como un test que se cae, no como un
// fixture que mutó solo.
const porCobrar    = (cliente_id: string | null) => orden({ cliente_id, condicion_pago: 'CONTRAENTREGA', shipping: { estado: 'en_ruta' } });
const aMedias      = (cliente_id: string | null) => orden({ cliente_id, shipping: { estado: 'preparando', mensajero: 'Luis', fecha_programada: null } });
const fallida      = (cliente_id: string | null) => orden({ cliente_id, shipping: { estado: 'fallido' } });
const sinVerificar = (cliente_id: string | null) => orden({ cliente_id, comprobantes: [{ estado: 'RECIBIDO' }] });
/** Tranquila: existe, es de alguien, y no pide nada. */
const tranquila    = (cliente_id: string | null) => orden({ cliente_id, estado: 'pagado', shipping: { estado: 'entregado' } });

test('cuenta SÓLO los pedidos que piden acción, no todos los del cliente', () => {
  // La implementación equivocada más probable —agrupar y contar sin consultar la
  // regla— daría 3 para `c1`. Las dos tranquilas están para que ese error no pase.
  const mapa = pedidosPorAtenderPorCliente([
    porCobrar('c1'), tranquila('c1'), tranquila('c1'),
  ]);
  assert.equal(mapa.get('c1'), 1);
});

test('los CUATRO motivos cuentan, no sólo el de cobro', () => {
  // Un recorte propio ("marco al cliente si tiene plata en la calle") pasaría el
  // test de arriba y fallaría acá: es el modo de falla que la reutilización de
  // `necesitaAtencion` existe para impedir.
  const mapa = pedidosPorAtenderPorCliente([
    porCobrar('c1'), aMedias('c1'), fallida('c1'), sinVerificar('c1'),
  ]);
  assert.equal(mapa.get('c1'), 4);
});

test('un cliente sin pedidos que atender NO aparece en el mapa', () => {
  // Disperso, no una entrada en cero: esta función sólo ve órdenes y no conoce la
  // lista de clientes, así que no puede afirmar nada sobre quien no aparece acá.
  const mapa = pedidosPorAtenderPorCliente([tranquila('c1')]);
  assert.equal(mapa.has('c1'), false);
  assert.equal(mapa.get('c1'), undefined);
});

test('cada cliente cuenta lo suyo', () => {
  const mapa = pedidosPorAtenderPorCliente([
    porCobrar('c1'), fallida('c1'), sinVerificar('c2'), tranquila('c3'),
  ]);
  assert.deepEqual([...mapa.entries()].sort(), [['c1', 2], ['c2', 1]]);
});

test('una orden CANCELADA no cuenta, aunque arrastre un motivo', () => {
  // La guarda vive en `necesitaAtencion` (cancelado es terminal y no pide nada).
  // Se afirma acá igual: si algún día esta capa dejara de consultar la regla, el
  // sol se encendería por pedidos muertos y nadie lo notaría desde el otro test.
  const cancelada = orden({
    cliente_id: 'c1', estado: 'cancelado',
    shipping: { estado: 'fallido' }, comprobantes: [{ estado: 'RECIBIDO' }],
  });
  assert.equal(pedidosPorAtenderPorCliente([cancelada]).size, 0);
});

test('una orden SIN cliente_id no se le atribuye a nadie', () => {
  // Ni se cuenta bajo una clave inventada (null/'') ni se reparte por snapshot: no
  // consta de quién es. Agrupar por teléfono metería los pedidos de una persona en
  // la cuenta de otra — `Customer.telefono` NO es único, por decisión de producto.
  const mapa = pedidosPorAtenderPorCliente([porCobrar(null), porCobrar(undefined as unknown as null)]);
  assert.equal(mapa.size, 0);
});

test('lista vacía → mapa vacío', () => {
  assert.equal(pedidosPorAtenderPorCliente([]).size, 0);
});
