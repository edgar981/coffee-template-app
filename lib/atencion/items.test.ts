import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemsDeAtencion, PRIORIDAD_ATENCION, type OrdenAtencion, type ProductoAtencion } from './items';

// Capa 1 de la lista transversal de atención: lo que importa NO es sólo que la
// lista se arme, sino que salga en el ORDEN correcto (por costo, no por sección) y
// con los desempates. El orden es la decisión de producto de esta pieza.

const orden = (o: Partial<OrdenAtencion>): OrdenAtencion => ({
  estado: 'pendiente', condicion_pago: 'ANTICIPADO',
  numero_orden: 'CN-000', cliente_nombre: 'Cliente', createdAt: '2026-08-01T10:00:00Z',
  ...o,
});

const PorCobrar = (o: Partial<OrdenAtencion> = {}) =>
  orden({ condicion_pago: 'CONTRAENTREGA', shipping: { estado: 'en_ruta' }, ...o });

const producto = (p: Partial<ProductoAtencion>): ProductoAtencion => ({
  nombre: 'Producto', stock: 3, stock_minimo: 10, activo: true, ...p,
});

test('ORDEN por COSTO, no por sección: un pedido por_cobrar va ANTES que un producto bajo mínimo', () => {
  const items = itemsDeAtencion(
    [PorCobrar({ numero_orden: 'CN-1', cliente_nombre: 'Laura' })],
    [producto({ nombre: 'Café Huila', stock: 3 })],
  );
  assert.equal(items.length, 2);
  assert.equal(items[0].seccion, 'pedidos');   // por_cobrar = prioridad 1
  assert.equal(items[1].seccion, 'productos'); // stock = prioridad 5
  assert.ok(items[0].prioridad < items[1].prioridad);
});

test('DESEMPATE dentro del mismo nivel: dos por_cobrar → la más VIEJA primero', () => {
  const nueva = PorCobrar({ numero_orden: 'CN-NEW', cliente_nombre: 'B', createdAt: '2026-08-05T10:00:00Z' });
  const vieja = PorCobrar({ numero_orden: 'CN-OLD', cliente_nombre: 'A', createdAt: '2026-08-01T10:00:00Z' });
  // Se pasan en orden INVERSO al esperado, para que el sort sea lo que decide.
  const items = itemsDeAtencion([nueva, vieja], []);
  assert.deepEqual(items.map(i => i.titulo), ['A · CN-OLD', 'B · CN-NEW']);
});

test('DESEMPATE del stock: agotado (0) va antes que bajo (>0), aunque se pasen al revés', () => {
  const items = itemsDeAtencion([], [
    producto({ nombre: 'Bajo',    stock: 3 }),
    producto({ nombre: 'Agotado', stock: 0 }),
  ]);
  assert.deepEqual(items.map(i => i.titulo), ['Agotado', 'Bajo']);
  assert.equal(items[0].subtitulo, 'Agotado · sin unidades');
  assert.equal(items[1].subtitulo, 'Quedan 3 · bajo el mínimo');
});

test('UN ítem por orden: dos motivos se ENCADENAN en el subtítulo (nada escondido) y hereda la prioridad más alta', () => {
  const both = PorCobrar({ numero_orden: 'CN-X', cliente_nombre: 'C', comprobantes: [{ estado: 'RECIBIDO' }] });
  const items = itemsDeAtencion([both], []);
  assert.equal(items.length, 1); // UNA fila, no dos
  assert.equal(items[0].subtitulo, 'Despachada sin cobrar · 1 comprobante sin verificar');
  assert.equal(items[0].prioridad, PRIORIDAD_ATENCION.por_cobrar); // la más alta de las dos
  assert.equal(items[0].titulo, 'C · CN-X');
});

test('el orden GLOBAL respeta la escala de prioridad (los 4 motivos + stock), pasados al revés', () => {
  const items = itemsDeAtencion(
    [
      orden({ numero_orden: 'CN-MED', cliente_nombre: 'Med', shipping: { estado: 'preparando', mensajero: 'Luis', fecha_programada: null } }), // a medias = 4
      orden({ numero_orden: 'CN-FAL', cliente_nombre: 'Fal', shipping: { estado: 'fallido' } }),                                                // fallida = 2
      PorCobrar({ numero_orden: 'CN-COB', cliente_nombre: 'Cob' }),                                                                             // por_cobrar = 1
      orden({ numero_orden: 'CN-VER', cliente_nombre: 'Ver', comprobantes: [{ estado: 'RECIBIDO' }] }),                                         // sin verificar = 3
    ],
    [producto({ nombre: 'Stock', stock: 2 })],                                                                                                  // stock = 5
  );
  // La secuencia de prioridad prueba el orden global (1<2<3<4<5), y la última es el stock.
  assert.deepEqual(items.map(i => i.prioridad), [1, 2, 3, 4, 5]);
  assert.deepEqual(items.map(i => i.seccion), ['pedidos', 'pedidos', 'pedidos', 'pedidos', 'productos']);
  assert.equal(items[0].titulo, 'Cob · CN-COB'); // por_cobrar lidera
  assert.equal(items[4].titulo, 'Stock');        // el stock cierra
  // El COLOR es la clase, el ORDEN es el costo: los pedidos van ámbar, el stock ROJO —
  // Y sigue al final aunque sea rojo. Dos ejes distintos.
  assert.deepEqual(items.map(i => i.tono), ['atencion', 'atencion', 'atencion', 'atencion', 'alerta']);
});

test('vacío es vacío: sin órdenes ni productos, y una orden sin motivos se SALTA', () => {
  assert.deepEqual(itemsDeAtencion([], []), []);
  const sinMotivos = orden({ numero_orden: 'CN-OK' }); // pendiente ANTICIPADO, nadie la tocó
  const productoOk = producto({ nombre: 'OK', stock: 50 }); // 50 > 10, no es bajo
  assert.deepEqual(itemsDeAtencion([sinMotivos], [productoOk]), []);
});
