import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cruzarMetodosPasarela } from './metodos-pasarela';

test('las dos listas vacías → []', () => {
  assert.deepEqual(cruzarMetodosPasarela([], []), []);
});

test('guardado === cuenta → todos disponible', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'NEQUI'], ['CARD', 'NEQUI']),
    [
      { tipo: 'CARD', estado: 'disponible' },
      { tipo: 'NEQUI', estado: 'disponible' },
    ],
  );
});

test('guardado vacío, cuenta con métodos → todos disponible_no_ofrecido', () => {
  assert.deepEqual(
    cruzarMetodosPasarela([], ['CARD', 'PSE']),
    [
      { tipo: 'CARD', estado: 'disponible_no_ofrecido' },
      { tipo: 'PSE', estado: 'disponible_no_ofrecido' },
    ],
  );
});

test('guardado con un tipo que la cuenta ya no tiene → guardado_no_disponible, al final', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'BRE_B'], ['CARD']),
    [
      { tipo: 'CARD', estado: 'disponible' },
      { tipo: 'BRE_B', estado: 'guardado_no_disponible' },
    ],
  );
});

test('los tres estados a la vez, en el orden de la cuenta primero', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'BRE_B'], ['PSE', 'CARD']),
    [
      { tipo: 'PSE', estado: 'disponible_no_ofrecido' },
      { tipo: 'CARD', estado: 'disponible' },
      { tipo: 'BRE_B', estado: 'guardado_no_disponible' },
    ],
  );
});

test('cuenta vacía, guardado con métodos → todos guardado_no_disponible', () => {
  assert.deepEqual(
    cruzarMetodosPasarela(['CARD', 'NEQUI'], []),
    [
      { tipo: 'CARD', estado: 'guardado_no_disponible' },
      { tipo: 'NEQUI', estado: 'guardado_no_disponible' },
    ],
  );
});
