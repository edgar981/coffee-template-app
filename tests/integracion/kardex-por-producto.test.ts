import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { logsDeInventario, KARDEX_TOPE } from '@duna/core/inventory';
import { prisma, limpiar, crearProducto } from './fixtures';

// EL KARDEX SE PUEDE PEDIR POR PRODUCTO.
//
// Es la mitad de servidor de la frontera Productos↔Inventario (decisión del
// owner): Productos responde "¿cómo está ESTE producto?" y su detalle muestra el
// kardex del producto que se está mirando; Inventario responde "¿qué tengo que
// reponer?" y se queda con el kardex COMPLETO, la vista de auditoría. Sin este
// filtro la primera mitad no se puede construir — el endpoint sólo sabía devolver
// los 200 movimientos más recientes de TODA la tienda.
//
// ── POR QUÉ EN EL CARRIL Y NO EN LA SUITE PURA ──────────────────────────────
//
// Lo que se afirma no es la forma de un objeto: es QUÉ FILAS devuelve la
// consulta. Un test con mocks pasaría en verde contra la versión sin filtro —el
// mock devuelve lo que uno le diga— y es justamente el defecto que se busca. Hay
// que releer la tabla.
//
// Se escribió contra la consulta SIN filtro y se la vio fallar. NO BORRAR: es lo
// único que impide que el kardex de un producto vuelva a mostrar los movimientos
// de todos.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/** Un asiento cualquiera, del tipo que sea: lo que se mide es a quién pertenece. */
async function asiento(producto: { id: string; nombre: string }, cantidad: number, motivo: string) {
  return prisma.inventoryLog.create({
    data: {
      producto_id:     producto.id,
      producto_nombre: producto.nombre,
      tipo:            'entrada',
      cantidad,
      stock_anterior:  0,
      stock_nuevo:     cantidad,
      motivo,
    },
  });
}

test('el kardex de UN producto trae SÓLO sus movimientos', async () => {
  const cafe  = await crearProducto({ slug: 'cafe-uno', stock: 10, stock_minimo: 5, nombre: 'Café Uno' });
  const prensa = await crearProducto({ slug: 'prensa', stock: 3, stock_minimo: 2, nombre: 'Prensa' });

  await asiento(cafe, 5, 'reposición del café');
  await asiento(prensa, 2, 'compra de prensas');
  await asiento(cafe, 7, 'otra del café');

  const soloCafe = await logsDeInventario({ productoId: cafe.id });

  assert.equal(soloCafe.length, 2);
  // La aserción fuerte NO es el conteo —dos productos podrían tener dos filas
  // cada uno— sino que ninguna fila ajena se coló.
  assert.ok(soloCafe.every(l => l.producto_id === cafe.id), 'se coló un movimiento de otro producto');
  assert.deepEqual(
    soloCafe.map(l => l.motivo).sort(),
    ['otra del café', 'reposición del café'],
  );
});

test('SIN producto sigue trayendo el kardex COMPLETO — el cambio es aditivo', async () => {
  const cafe   = await crearProducto({ slug: 'cafe-dos', stock: 10, stock_minimo: 5, nombre: 'Café Dos' });
  const prensa = await crearProducto({ slug: 'prensa-2', stock: 3, stock_minimo: 2, nombre: 'Prensa 2' });

  await asiento(cafe, 5, 'del café');
  await asiento(prensa, 2, 'de la prensa');

  // Las dos formas de "no filtrar" tienen que dar lo mismo: sin argumentos y con
  // el objeto vacío. Si divergieran, el llamador de siempre —que no pasa nada—
  // estaría en un camino distinto del que este test ejercita.
  const todos     = await logsDeInventario();
  const tambien   = await logsDeInventario({});

  assert.equal(todos.length, 2);
  assert.equal(tambien.length, 2);
  assert.deepEqual(new Set(todos.map(l => l.producto_id)), new Set([cafe.id, prensa.id]));
});

test('un producto SIN movimientos devuelve vacío, no los de otro', async () => {
  const cafe  = await crearProducto({ slug: 'cafe-tres', stock: 10, stock_minimo: 5, nombre: 'Café Tres' });
  const nuevo = await crearProducto({ slug: 'recien-creado', stock: 0, stock_minimo: 1, nombre: 'Recién creado' });

  await asiento(cafe, 5, 'sólo del café');

  const suyos = await logsDeInventario({ productoId: nuevo.id });
  // Es el caso que MÁS engaña sin el filtro: la consulta devolvía filas y el
  // detalle de un producto nuevo mostraba movimientos que no eran suyos.
  assert.deepEqual(suyos, []);
});

test('un productoId que no existe devuelve vacío — no lanza y no trae todo', async () => {
  const cafe = await crearProducto({ slug: 'cafe-cuatro', stock: 10, stock_minimo: 5, nombre: 'Café Cuatro' });
  await asiento(cafe, 5, 'del café');

  assert.deepEqual(await logsDeInventario({ productoId: 'no-existe-este-id' }), []);
});

test('el orden es del más RECIENTE al más viejo', async () => {
  const cafe = await crearProducto({ slug: 'cafe-cinco', stock: 10, stock_minimo: 5, nombre: 'Café Cinco' });

  // Separados en el tiempo A PROPÓSITO: `createdAt` es timestamp(3) y dos
  // asientos del mismo milisegundo no tienen desempate (§ el límite anotado en
  // `logsDeInventario`). Un test que los escribiera seguidos sería intermitente,
  // y un test que pasa según la suerte del reloj no es un test.
  await asiento(cafe, 1, 'el viejo');
  await new Promise(r => setTimeout(r, 5));
  await asiento(cafe, 2, 'el nuevo');

  const kardex = await logsDeInventario({ productoId: cafe.id });
  assert.deepEqual(kardex.map(l => l.motivo), ['el nuevo', 'el viejo']);
});

test('`take` acota, y su default es el tope que el endpoint ya traía', async () => {
  const cafe = await crearProducto({ slug: 'cafe-seis', stock: 10, stock_minimo: 5, nombre: 'Café Seis' });
  for (let i = 0; i < 5; i++) await asiento(cafe, i + 1, `mov ${i}`);

  assert.equal((await logsDeInventario({ productoId: cafe.id, take: 2 })).length, 2);
  assert.equal((await logsDeInventario({ productoId: cafe.id })).length, 5);
  // El tope por defecto es el mismo número que estaba escrito en el handler; si
  // alguien lo cambia, que sea una decisión y no un descuido.
  assert.equal(KARDEX_TOPE, 200);
});
