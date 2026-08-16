import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoSeleccion } from './auto-seleccion';

// ── El mecanismo que el defecto rompía: RE-EVALUAR al cambiar el carril ──────
//
// Cambiar de carril con un seleccionado que NO está en el carril nuevo debe
// seleccionar el primero. Sin la re-evaluación (el efecto viejo bailaba si había
// selección), esto se quedaría en 'conservar' — y este test falla, que es lo que
// debe pasar.
test('carril nuevo SIN el seleccionado: selecciona el primero', () => {
  assert.deepEqual(
    autoSeleccion({ seleccion: 'X', idsVisibles: ['A', 'B'], primeraVez: false }),
    { tipo: 'seleccionar', id: 'A' },
  );
});

// ── Filtrar acota, no deselecciona ──────────────────────────────────────────
test('el seleccionado sigue en el carril nuevo: se conserva', () => {
  assert.deepEqual(
    autoSeleccion({ seleccion: 'B', idsVisibles: ['A', 'B'], primeraVez: false }),
    { tipo: 'conservar' },
  );
});

// ── Carril vacío → placeholder, no panel rancio ─────────────────────────────
test('carril nuevo vacío con selección previa: se limpia', () => {
  assert.deepEqual(
    autoSeleccion({ seleccion: 'X', idsVisibles: [], primeraVez: false }),
    { tipo: 'limpiar' },
  );
});

test('carril vacío SIN selección previa: nada que limpiar', () => {
  assert.deepEqual(
    autoSeleccion({ seleccion: null, idsVisibles: [], primeraVez: false }),
    { tipo: 'conservar' },
  );
});

// ── Carga inicial: el deep link gana ────────────────────────────────────────
test('primera vez con deep link: se conserva aunque NO esté en el carril', () => {
  // ?pedido=X&estado=pagado con X pendiente: X no está en visibles, pero el deep
  // link gana en la carga inicial.
  assert.deepEqual(
    autoSeleccion({ seleccion: 'X', idsVisibles: ['A', 'B'], primeraVez: true }),
    { tipo: 'conservar' },
  );
});

test('primera vez sin selección: auto-selecciona el primero', () => {
  assert.deepEqual(
    autoSeleccion({ seleccion: null, idsVisibles: ['A', 'B'], primeraVez: true }),
    { tipo: 'seleccionar', id: 'A' },
  );
});

test('primera vez sin selección y lista vacía: nada', () => {
  assert.deepEqual(
    autoSeleccion({ seleccion: null, idsVisibles: [], primeraVez: true }),
    { tipo: 'conservar' },
  );
});

// El primero es el primero de la lista (el más reciente, orden preservado).
test('selecciona el PRIMERO de la lista, no otro', () => {
  const r = autoSeleccion({ seleccion: 'Z', idsVisibles: ['m', 'n', 'o'], primeraVez: false });
  assert.deepEqual(r, { tipo: 'seleccionar', id: 'm' });
});
