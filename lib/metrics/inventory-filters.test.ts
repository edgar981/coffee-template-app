import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLowStock, cruzoMinimo, DEFAULT_STOCK_MINIMO } from './inventory-filters';

// `cruzoMinimo` es el disparador de la alerta de stock de la campana, y lo llaman
// DOS emisores distintos (el ajuste de inventario y el descuento al despachar).
// La regla vale por lo que NO hace: avisar del ESTADO "está bajo" en vez del
// CRUCE convierte cada venta de un producto agotado en una notificación, y una
// campana que repite es una campana que se ignora.

const ref = { stock_minimo: 5, activo: true };

test('cruzar el mínimo hacia abajo dispara', () => {
  assert.equal(cruzoMinimo(8, 4, ref), true);
});

test('quedar EXACTAMENTE en el mínimo es cruzar — `<=`, igual que la card', () => {
  assert.equal(cruzoMinimo(8, 5, ref), true);
});

test('seguir bajando por debajo del mínimo NO vuelve a disparar', () => {
  // El caso que motiva la regla: el producto ya estaba bajo, así que cada
  // movimiento posterior no es información nueva.
  assert.equal(cruzoMinimo(4, 2, ref), false);
  assert.equal(cruzoMinimo(2, 0, ref), false);
});

test('un movimiento enteramente por encima del mínimo no dispara', () => {
  assert.equal(cruzoMinimo(20, 12, ref), false);
});

test('reponer no dispara — el cruce es sólo hacia abajo', () => {
  assert.equal(cruzoMinimo(2, 30, ref), false);
});

test('un producto inactivo nunca dispara: no es una alerta accionable', () => {
  assert.equal(cruzoMinimo(8, 1, { stock_minimo: 5, activo: false }), false);
});

test('sin stock_minimo explícito se usa el default del schema', () => {
  assert.equal(cruzoMinimo(DEFAULT_STOCK_MINIMO + 1, DEFAULT_STOCK_MINIMO, {}), true);
  assert.equal(cruzoMinimo(DEFAULT_STOCK_MINIMO + 2, DEFAULT_STOCK_MINIMO + 1, {}), false);
});

test('cruzoMinimo se construye sobre isLowStock — un solo predicado', () => {
  // Si alguien reimplementara la comparación aquí, esta aserción seguiría pasando
  // pero la de abajo se caería al cambiar `isLowStock`. Es el vínculo explícito
  // entre el aviso de la campana y lo que se ve en Inventario.
  const anterior = 8, nuevo = 3;
  assert.equal(
    cruzoMinimo(anterior, nuevo, ref),
    !isLowStock({ ...ref, stock: anterior }) && isLowStock({ ...ref, stock: nuevo }),
  );
});
