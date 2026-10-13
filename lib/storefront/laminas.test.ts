import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LAMINAS_MAX, laminasVisibles, contadorLamina, repartoPaginasLaminas } from './laminas';

interface LaminaFake {
  foto: string;
  titulo: string;
}

const lam = (foto: string, titulo = ''): LaminaFake => ({ foto, titulo });

describe('laminasVisibles', () => {
  test('filtra las láminas sin foto', () => {
    const items = [lam('a.jpg'), lam(''), lam('b.jpg'), lam('  ')];
    assert.deepEqual(laminasVisibles(items).map((l) => l.foto), ['a.jpg', 'b.jpg']);
  });

  test('recorta al tope DESPUÉS de filtrar — una fila vacía en el medio no gasta un cupo', () => {
    const items = [lam('1'), lam('2'), lam(''), lam('3'), lam('4'), lam('5'), lam('6'), lam('7')];
    const visibles = laminasVisibles(items, 6);
    assert.equal(visibles.length, 6);
    assert.deepEqual(visibles.map((l) => l.foto), ['1', '2', '3', '4', '5', '6']);
  });

  test('con todas las fotos presentes y menos que el tope, las devuelve todas', () => {
    const items = [lam('1'), lam('2'), lam('3')];
    assert.equal(laminasVisibles(items).length, 3);
  });

  test('array vacío → array vacío', () => {
    assert.deepEqual(laminasVisibles([]), []);
  });

  test('LAMINAS_MAX es 6, el default del tope', () => {
    assert.equal(LAMINAS_MAX, 6);
    const siete = Array.from({ length: 7 }, (_, i) => lam(String(i)));
    assert.equal(laminasVisibles(siete).length, 6);
  });
});

describe('contadorLamina', () => {
  test('1ª de 5 → "01/05"', () => {
    assert.equal(contadorLamina(0, 5), '01/05');
  });

  test('última de 5 → "05/05"', () => {
    assert.equal(contadorLamina(4, 5), '05/05');
  });

  test('un total de un solo dígito sigue a DOS dígitos', () => {
    assert.equal(contadorLamina(0, 3), '01/03');
    assert.equal(contadorLamina(2, 3), '03/03');
  });

  test('un total de dos dígitos (el tope, 6) se formatea igual', () => {
    assert.equal(contadorLamina(5, 6), '06/06');
  });
});

describe('repartoPaginasLaminas', () => {
  test('5 ítems → 3 izquierda + 2 derecha (el caso de la maqueta)', () => {
    const items = [1, 2, 3, 4, 5];
    const { izquierda, derecha } = repartoPaginasLaminas(items);
    assert.deepEqual(izquierda, [1, 2, 3]);
    assert.deepEqual(derecha, [4, 5]);
  });

  test('6 ítems (el tope) → 3 + 3', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const { izquierda, derecha } = repartoPaginasLaminas(items);
    assert.equal(izquierda.length, 3);
    assert.equal(derecha.length, 3);
  });

  test('3 ítems → 2 izquierda + 1 derecha, nunca al revés', () => {
    const items = [1, 2, 3];
    const { izquierda, derecha } = repartoPaginasLaminas(items);
    assert.deepEqual(izquierda, [1, 2]);
    assert.deepEqual(derecha, [3]);
  });

  test('4 ítems (par) → 2 + 2', () => {
    const items = [1, 2, 3, 4];
    const { izquierda, derecha } = repartoPaginasLaminas(items);
    assert.deepEqual(izquierda, [1, 2]);
    assert.deepEqual(derecha, [3, 4]);
  });

  test('0 ítems → las dos páginas vacías, sin lanzar', () => {
    const { izquierda, derecha } = repartoPaginasLaminas([]);
    assert.deepEqual(izquierda, []);
    assert.deepEqual(derecha, []);
  });

  test('1 ítem → va entero a la izquierda', () => {
    const { izquierda, derecha } = repartoPaginasLaminas(['única']);
    assert.deepEqual(izquierda, ['única']);
    assert.deepEqual(derecha, []);
  });
});
