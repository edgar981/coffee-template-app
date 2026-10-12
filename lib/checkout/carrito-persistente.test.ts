import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  guardarCarrito,
  restaurarCarrito,
  limpiarCarritoPersistido,
  CLAVE_CARRITO_PERSISTIDO,
  TTL_CARRITO_PERSISTIDO_MS,
} from './carrito-persistente';

// Un storage en memoria — el mismo contrato que `localStorage`, sin depender de jsdom.
function storageFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => (datos.has(k) ? datos.get(k)! : null),
    setItem: (k: string, v: string) => { datos.set(k, v); },
    removeItem: (k: string) => { datos.delete(k); },
    _datos: datos,
  };
}

const ITEM = { id: 'p1', nombre: 'Café La Ceiba', precio: 35000, quantity: 2, key: 'p1-{}' };

test('guardar → restaurar: items y departamento sobreviven tal cual', () => {
  const storage = storageFalso();
  guardarCarrito([ITEM], 'Antioquia', storage);
  const restaurado = restaurarCarrito(storage);
  assert.deepEqual(restaurado.items, [ITEM]);
  assert.equal(restaurado.departamento, 'Antioquia');
});

test('guardar sin departamento elegido todavía → null, no se pierde nada más', () => {
  const storage = storageFalso();
  guardarCarrito([ITEM], null, storage);
  const restaurado = restaurarCarrito(storage);
  assert.equal(restaurado.departamento, null);
  assert.deepEqual(restaurado.items, [ITEM]);
});

test('restaurar sin nada guardado → carrito vacío, sin lanzar', () => {
  const storage = storageFalso();
  const restaurado = restaurarCarrito(storage);
  assert.deepEqual(restaurado, { items: [], departamento: null });
});

test('restaurar con storage AUSENTE (null) → carrito vacío, sin lanzar', () => {
  const restaurado = restaurarCarrito(null);
  assert.deepEqual(restaurado, { items: [], departamento: null });
});

test('guardar con storage AUSENTE (null) → no lanza', () => {
  assert.doesNotThrow(() => guardarCarrito([ITEM], 'Valle del Cauca', null));
});

test('versión VIEJA guardada → se descarta, no se restaura', () => {
  const storage = storageFalso();
  storage.setItem(CLAVE_CARRITO_PERSISTIDO, JSON.stringify({ v: 0, guardadoEn: Date.now(), items: [ITEM], departamento: null }));
  const restaurado = restaurarCarrito(storage);
  assert.deepEqual(restaurado, { items: [], departamento: null });
});

test('JSON roto guardado → se descarta, no lanza', () => {
  const storage = storageFalso();
  storage.setItem(CLAVE_CARRITO_PERSISTIDO, '{ esto no es json');
  assert.doesNotThrow(() => restaurarCarrito(storage));
  assert.deepEqual(restaurarCarrito(storage), { items: [], departamento: null });
});

test('forma inesperada (sin items, sin guardadoEn) → se descarta', () => {
  const storage = storageFalso();
  storage.setItem(CLAVE_CARRITO_PERSISTIDO, JSON.stringify({ v: 1 }));
  assert.deepEqual(restaurarCarrito(storage), { items: [], departamento: null });

  const storage2 = storageFalso();
  storage2.setItem(CLAVE_CARRITO_PERSISTIDO, JSON.stringify('no es un objeto'));
  assert.deepEqual(restaurarCarrito(storage2), { items: [], departamento: null });
});

test('dentro del TTL (incluido el instante exacto) → se restaura; un milisegundo después → ya no', () => {
  const storage = storageFalso();
  const guardadoEn = 1_000_000;
  storage.setItem(CLAVE_CARRITO_PERSISTIDO, JSON.stringify({ v: 1, guardadoEn, items: [ITEM], departamento: null }));

  const dentro = restaurarCarrito(storage, guardadoEn + TTL_CARRITO_PERSISTIDO_MS - 1);
  assert.deepEqual(dentro.items, [ITEM]);

  const justoEnElInstanteExacto = restaurarCarrito(storage, guardadoEn + TTL_CARRITO_PERSISTIDO_MS);
  assert.deepEqual(justoEnElInstanteExacto.items, [ITEM]);

  const unMsDespues = restaurarCarrito(storage, guardadoEn + TTL_CARRITO_PERSISTIDO_MS + 1);
  assert.deepEqual(unMsDespues, { items: [], departamento: null });
});

test('caducado (más allá del TTL) → carrito vacío, no el viejo', () => {
  const storage = storageFalso();
  const guardadoEn = Date.now() - TTL_CARRITO_PERSISTIDO_MS - 1000;
  storage.setItem(CLAVE_CARRITO_PERSISTIDO, JSON.stringify({ v: 1, guardadoEn, items: [ITEM], departamento: 'Huila' }));
  const restaurado = restaurarCarrito(storage);
  assert.deepEqual(restaurado, { items: [], departamento: null });
});

test('limpiarCarritoPersistido: borra lo guardado, tolera storage ausente', () => {
  const storage = storageFalso();
  guardarCarrito([ITEM], 'Nariño', storage);
  limpiarCarritoPersistido(storage);
  assert.deepEqual(restaurarCarrito(storage), { items: [], departamento: null });
  assert.doesNotThrow(() => limpiarCarritoPersistido(null));
});

test('un storage que LANZA al leer/escribir no tumba ninguna de las tres funciones', () => {
  const storageQueLanza = {
    getItem: () => { throw new Error('bloqueado'); },
    setItem: () => { throw new Error('lleno'); },
    removeItem: () => { throw new Error('bloqueado'); },
  };
  assert.doesNotThrow(() => guardarCarrito([ITEM], null, storageQueLanza));
  assert.deepEqual(restaurarCarrito(storageQueLanza), { items: [], departamento: null });
  assert.doesNotThrow(() => limpiarCarritoPersistido(storageQueLanza));
});
