import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARRILES_PRODUCTOS, carrilPorKey, aplicarCarril, conteosProductos,
  porReponer, agotados, sinPublicar, aplicarCategoria,
  coincideProducto, buscarProductos, type ProductoParaFiltro,
} from './filtros';
import { nivelStock, etiquetaStock, claseStock } from './stock';

const p = (x: Partial<ProductoParaFiltro> = {}): ProductoParaFiltro =>
  ({ nombre: 'Producto', stock: 20, stock_minimo: 5, activo: true, ...x });

const sano       = p({ nombre: 'Café Sierra',  sku: 'SN-001', stock: 20, categoria: 'cafe_grano' });
const bajo       = p({ nombre: 'Café Huila',   sku: 'SN-002', stock: 4,  categoria: 'cafe_grano' });
const enElBorde  = p({ nombre: 'Café Nariño',  sku: 'SN-003', stock: 5,  categoria: 'cafe_molido' });
const agotado    = p({ nombre: 'Cold Brew',    sku: 'CB-001', stock: 0,  categoria: 'cold_brew' });
const inactivo   = p({ nombre: 'Bono',         sku: 'BN-001', stock: 0,  activo: false, categoria: 'caja_regalo' });
const inactivoOk = p({ nombre: 'Caja vieja',   sku: 'CJ-001', stock: 30, activo: false, categoria: 'caja_regalo' });
const TODOS = [sano, bajo, enElBorde, agotado, inactivo, inactivoOk];

// ═══ LOS CARRILES ════════════════════════════════════════════════════════════

test('los CUATRO carriles, y el conjunto es la decisión', () => {
  assert.deepEqual(
    CARRILES_PRODUCTOS.map(c => c.label),
    ['Todos', 'Por reponer', 'Agotados', 'Sin publicar'],
  );
});

test('"Sin publicar" es ACUMULADOR y por eso NO lleva número', () => {
  // No es un detalle de estilo: un producto despublicado es una decisión
  // deliberada, no trabajo esperando. La maqueta lo dibuja con conteo.
  assert.equal(carrilPorKey('sin_publicar')!.tipo, 'acumulador');
  assert.equal(conteosProductos(TODOS).sin_publicar, undefined);
  // Y las colas SÍ lo llevan, incluso en cero (un cero es una respuesta).
  assert.equal(conteosProductos(TODOS).reponer, 3);   // bajo, enElBorde, agotado
  assert.equal(conteosProductos([sano]).reponer, 0);
});

test('"Todos" NO excluye a los inactivos — un producto sin publicar sigue siendo del catálogo', () => {
  // A diferencia de Pedidos, donde "Todos" deja fuera las canceladas porque
  // existe una definición única de orden contable. Acá no hay equivalente.
  assert.equal(aplicarCarril(TODOS, 'todos').length, TODOS.length);
});

test('el borde del mínimo cuenta: `stock <= stock_minimo`, no `<`', () => {
  // 5 y mínimo 5 ES bajo. Un `<` acá dejaría de reconciliar con la card del
  // dashboard, que usa el mismo predicado compartido.
  assert.equal(porReponer(enElBorde), true);
});

test('"Por reponer" EXCLUYE inactivos, y eso viene del predicado compartido', () => {
  assert.equal(porReponer(inactivo), false, 'inactivo en cero no es una reposición pendiente');
  assert.equal(aplicarCarril(TODOS, 'reponer').includes(inactivo), false);
});

// ── LA CONTENCIÓN, que es la propiedad que este archivo existe para garantizar ─

test('AGOTADOS ⊆ POR REPONER, y no por casualidad', () => {
  // La contención se afirma sobre TODO el conjunto, no sobre un caso elegido.
  for (const x of TODOS) {
    if (agotados(x)) {
      assert.ok(porReponer(x), `${x.nombre} está en Agotados pero no en Por reponer`);
    }
  }
  const enAgotados = aplicarCarril(TODOS, 'agotados');
  const enReponer  = aplicarCarril(TODOS, 'reponer');
  assert.ok(enAgotados.every(x => enReponer.includes(x)));
  assert.ok(conteosProductos(TODOS).agotados! <= conteosProductos(TODOS).reponer!);
});

test('EL CASO QUE ROMPERÍA la contención si se escribiera `stock === 0` suelto', () => {
  // Un producto INACTIVO y en cero. Con el predicado derivado queda fuera de los
  // DOS carriles; con un `stock === 0` suelto estaría en Agotados y no en Por
  // reponer, y la contención dejaría de ser cierta sin que nada avisara.
  assert.equal(inactivo.stock, 0);
  assert.equal(agotados(inactivo), false);
  assert.equal(porReponer(inactivo), false);
});

test('sinPublicar mira `activo === false`, no la falsedad del valor', () => {
  assert.equal(sinPublicar(inactivo), true);
  assert.equal(sinPublicar(sano), false);
  // `undefined` = activo (es el default del schema y el de `StockRef`).
  assert.equal(sinPublicar(p({ activo: undefined })), false);
});

test('una key de URL que no existe devuelve null, no se cae a "todos" en silencio', () => {
  assert.equal(carrilPorKey('inventado'), null);
});

// ═══ LA CATEGORÍA · alcance, no carril ═══════════════════════════════════════

test('la categoría no es un carril — se combina con cualquiera de los cuatro', () => {
  assert.equal(CARRILES_PRODUCTOS.some(c => /categor/i.test(c.label)), false);
  const soloGrano = aplicarCategoria(TODOS, 'cafe_grano');
  assert.deepEqual(soloGrano.map(x => x.nombre), ['Café Sierra', 'Café Huila']);
  // Y el conteo del pill habla de lo que hay DEBAJO del alcance puesto.
  assert.equal(conteosProductos(soloGrano).reponer, 1);
});

test('sin categoría no filtra — distinto de filtrar y no encontrar', () => {
  assert.equal(aplicarCategoria(TODOS, null).length, TODOS.length);
  assert.equal(aplicarCategoria(TODOS, '').length, TODOS.length);
  assert.equal(aplicarCategoria(TODOS, 'no_existe').length, 0);
});

// ═══ LA BÚSQUEDA ═════════════════════════════════════════════════════════════

test('empata por nombre y por SKU, sin distinguir mayúsculas', () => {
  assert.equal(coincideProducto(sano, 'sierra'), true);
  assert.equal(coincideProducto(sano, 'SIERRA'), true);
  assert.equal(coincideProducto(sano, 'sn-001'), true);
  assert.equal(coincideProducto(sano, 'huila'), false);
});

test('el SKU empata SIN separadores — se teclea "SN001" tanto como "SN-001"', () => {
  // El operador lo lee de una caja o de una factura, no del formato en que quedó
  // guardado. Mismo problema que el teléfono en Clientes, con otro separador.
  assert.equal(coincideProducto(sano, 'sn001'), true);
  assert.equal(coincideProducto(sano, 'SN 001'), true);
  assert.equal(coincideProducto(sano, 'sn.001'), true);
});

test('una consulta de puros separadores NO empata con todo', () => {
  // Sin la guarda del vacío, `''.includes('')` haría que "-" empatara con
  // cualquier SKU. Es el mismo agujero que la guarda de dígitos en Clientes.
  assert.equal(coincideProducto(sano, '-'), false);
  assert.equal(coincideProducto(sano, '--'), false);
});

test('un producto SIN sku no explota al buscar', () => {
  const sinSku = p({ nombre: 'Sin código', sku: null });
  assert.equal(coincideProducto(sinSku, 'código'), true);
  assert.equal(coincideProducto(sinSku, 'sn001'), false);
});

test('consulta vacía empata con todos — no filtrar no es no encontrar', () => {
  assert.equal(buscarProductos(TODOS, '').length, TODOS.length);
  assert.equal(buscarProductos(TODOS, '   ').length, TODOS.length);
});

// ═══ EL NIVEL DE STOCK · lo que dice la TARJETA ══════════════════════════════

test('el nivel del número: agotado gana sobre bajo', () => {
  assert.equal(nivelStock(sano), 'ok');
  assert.equal(nivelStock(bajo), 'bajo');
  assert.equal(nivelStock(enElBorde), 'bajo');
  assert.equal(nivelStock(agotado), 'agotado');
});

test('LA COSTURA DECLARADA: la tarjeta DESCRIBE y el carril CONVOCA', () => {
  // Un producto INACTIVO bajo su mínimo: su tarjeta dice "por reponer" y el
  // carril no lo cuenta. Es correcto y está escrito — la tarjeta habla del
  // número que tiene delante; el carril convoca trabajo, y un despublicado no
  // es trabajo. Se afirma para que sea una DECISIÓN y no un accidente.
  const inactivoBajo = p({ nombre: 'Inactivo bajo', stock: 3, stock_minimo: 5, activo: false });
  assert.equal(nivelStock(inactivoBajo), 'bajo');
  assert.equal(porReponer(inactivoBajo), false);
});

test('el estado NORMAL no se etiqueta — se etiqueta la excepción', () => {
  assert.equal(etiquetaStock(sano), null);
  assert.equal(etiquetaStock(bajo), 'Por reponer');
  assert.equal(etiquetaStock(agotado), 'Agotado');
});

test('la clase del número sale del sistema, y el estado normal no tiene tratamiento', () => {
  assert.equal(claseStock(sano), 'duna-stock-txt');
  assert.equal(claseStock(bajo), 'duna-stock-txt is-low');
  assert.equal(claseStock(agotado), 'duna-stock-txt is-out');
});

test('un producto sin `stock_minimo` cae al default del schema (5)', () => {
  assert.equal(nivelStock(p({ stock: 5, stock_minimo: undefined })), 'bajo');
  assert.equal(nivelStock(p({ stock: 6, stock_minimo: undefined })), 'ok');
});
