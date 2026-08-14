import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARRILES_CLIENTES, carrilPorKey, aplicarCarril, conteosClientes,
  coincideCliente, buscarClientes, type ClienteParaFiltro,
} from './filtros';

const c = (x: Partial<ClienteParaFiltro> = {}): ClienteParaFiltro => ({ nombre: 'Sin nombre', ordenes: 0, pedidosPorAtender: 0, ...x });

const nuevo       = c({ nombre: 'Ana Ruiz' });                                   // 0 pedidos
const unaCompra   = c({ nombre: 'Beto Díaz',  ordenes: 1 });
const recurrente  = c({ nombre: 'Carla Gil',  ordenes: 4 });
const conAtencion = c({ nombre: 'Diego Mora', ordenes: 2, pedidosPorAtender: 1 });
const TODOS = [nuevo, unaCompra, recurrente, conAtencion];

test('los CUATRO carriles, y el conjunto es la decisión', () => {
  assert.deepEqual(
    CARRILES_CLIENTES.map(x => x.label),
    ['Todos', 'Necesitan atención', 'Recurrentes', 'Sin compras'],
  );
  // NO hay carril de "inactivos": el dominio no tiene criterio de inactividad
  // consultable, y fabricarlo acá sería inventar la regla en la pantalla.
  assert.ok(!CARRILES_CLIENTES.some(x => /inactiv/i.test(x.label)));
});

test('una key inexistente da null, no "todos" en silencio', () => {
  assert.equal(carrilPorKey('inventado'), null);
  assert.equal(carrilPorKey('atencion')?.key, 'atencion');
});

test('atención lee el conteo del servidor, no lo recalcula', () => {
  assert.deepEqual(aplicarCarril(TODOS, 'atencion'), [conAtencion]);
  // Un cliente con muchos pedidos pero ninguno pidiendo acción NO entra: el carril
  // no es "cliente activo", es "tiene pedidos que atender".
  assert.ok(!aplicarCarril(TODOS, 'atencion').includes(recurrente));
});

test('recurrente es MÁS DE UNO, no "al menos uno"', () => {
  // El corte en 1 es la diferencia entre "volvió" y "compró": con `>= 1` la
  // primera compra ya haría recurrente a cualquiera y el carril no diría nada.
  assert.deepEqual(aplicarCarril(TODOS, 'recurrentes'), [recurrente, conAtencion]);
  assert.ok(!aplicarCarril(TODOS, 'recurrentes').includes(unaCompra));
});

test('sin compras es CERO, y no incluye al de una', () => {
  assert.deepEqual(aplicarCarril(TODOS, 'sin_compras'), [nuevo]);
});

test('"todos" no filtra', () => {
  assert.equal(aplicarCarril(TODOS, 'todos').length, 4);
});

test('sólo la COLA trae número; los acumuladores no', () => {
  const n = conteosClientes(TODOS);
  // Los tres acumuladores cuentan histórico que sólo crece y no pide ninguna
  // acción. AUSENCIA, no cero: que el dato no exista impide que el render lo
  // pinte sin querer.
  assert.equal(n.todos, undefined);
  assert.equal(n.recurrentes, undefined);
  assert.equal(n.sin_compras, undefined);
  // "Necesitan atención" es lo único transitorio acá: se vacía cuando se atienden
  // los pedidos que lo encienden.
  //
  // El `deepEqual` va AL FINAL a propósito: `assert.deepEqual` es una función de
  // aserción (`asserts actual is T`), así que estrecha `n` al literal y las
  // claves ausentes dejan de existir para el compilador a partir de acá. Con él
  // arriba, los tres `equal(..., undefined)` no compilan — y `npm test` pasaba
  // igual, porque corre con tsx y NO es gate de tipos.
  assert.deepEqual(n, { atencion: 1 });
});

test('el conteo de la cola CUADRA con lo que su carril muestra', () => {
  const n = conteosClientes(TODOS);
  for (const carril of CARRILES_CLIENTES.filter(c => c.tipo === 'cola')) {
    assert.equal(n[carril.key], aplicarCarril(TODOS, carril.key).length, carril.label);
  }
});

test('CADA carril declara qué cuenta — no se puede omitir', () => {
  assert.deepEqual(
    CARRILES_CLIENTES.map(c => [c.key, c.tipo]),
    [
      ['todos', 'acumulador'],
      ['atencion', 'cola'],
      ['recurrentes', 'acumulador'],
      ['sin_compras', 'acumulador'],
    ],
  );
});

// ─── BÚSQUEDA ────────────────────────────────────────────────────────────────

const conTelefono = c({ nombre: 'Laura Cárdenas', email: 'laura@correo.com', telefono: '+573001234567' });

test('empata por nombre y por correo, sin distinguir mayúsculas', () => {
  assert.ok(coincideCliente(conTelefono, 'laura'));
  assert.ok(coincideCliente(conTelefono, 'CÁRDENAS'));
  assert.ok(coincideCliente(conTelefono, 'correo.com'));
  assert.ok(!coincideCliente(conTelefono, 'pedro'));
});

test('el TELÉFONO se compara por DÍGITOS, no por texto crudo', () => {
  // Es el defecto de la lista vieja (`telefono.includes(search)`): el número
  // guardado está canonizado (+57…) y el operador teclea lo que le dictaron.
  assert.ok(coincideCliente(conTelefono, '300 123'),  'con espacio');
  assert.ok(coincideCliente(conTelefono, '300-123'),  'con guion');
  assert.ok(coincideCliente(conTelefono, '3001234567'), 'sin indicativo');
  assert.ok(coincideCliente(conTelefono, '+57 300'),  'con indicativo y espacio');
  assert.ok(!coincideCliente(conTelefono, '999'),     'un número que no es suyo');
});

test('texto SIN dígitos nunca empata por teléfono', () => {
  // Sin la guarda de `digitos`, `''.includes('')` haría que cualquier palabra
  // empatara con cualquier teléfono y la búsqueda dejaría de filtrar.
  const otro = c({ nombre: 'Zulema', telefono: '+573001234567' });
  assert.ok(!coincideCliente(otro, 'laura'));
});

test('consulta vacía empata con todos — no filtrar ≠ no encontrar', () => {
  assert.equal(buscarClientes(TODOS, '').length, 4);
  assert.equal(buscarClientes(TODOS, '   ').length, 4);
});

test('un cliente sin correo ni teléfono no revienta la búsqueda', () => {
  const pelado = c({ nombre: 'Solo Nombre' });
  assert.ok(coincideCliente(pelado, 'solo'));
  assert.ok(!coincideCliente(pelado, '300'));
});
