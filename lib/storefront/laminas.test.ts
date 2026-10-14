import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  LAMINAS_MAX, laminasVisibles, contadorLamina, repartoPaginasLaminas, esLaminaAncha, tituloLamina,
} from './laminas';

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

describe('esLaminaAncha', () => {
  test('el ejemplo de la maqueta: página de 3 → ancha, angosta, angosta', () => {
    assert.equal(esLaminaAncha(0, 3), true);
    assert.equal(esLaminaAncha(1, 3), false);
    assert.equal(esLaminaAncha(2, 3), false);
  });

  test('el ejemplo de la maqueta: página de 2 → ancha, ancha (la sobrante no queda sola a media fila)', () => {
    assert.equal(esLaminaAncha(0, 2), true);
    assert.equal(esLaminaAncha(1, 2), true);
  });

  test('página de 1 → la única va ancha', () => {
    assert.equal(esLaminaAncha(0, 1), true);
  });

  test('página de 4 → ancha, angosta, angosta, ancha — de las 3 que quedan tras la primera, 2 emparejan y la última sobrante va ancha', () => {
    assert.equal(esLaminaAncha(0, 4), true);
    assert.equal(esLaminaAncha(1, 4), false);
    assert.equal(esLaminaAncha(2, 4), false);
    assert.equal(esLaminaAncha(3, 4), true);
  });

  test('página de 5 → ancha, angosta×2, angosta×2 — las 4 que quedan emparejan sin sobrante', () => {
    assert.equal(esLaminaAncha(0, 5), true);
    assert.equal(esLaminaAncha(1, 5), false);
    assert.equal(esLaminaAncha(2, 5), false);
    assert.equal(esLaminaAncha(3, 5), false);
    assert.equal(esLaminaAncha(4, 5), false);
  });
});

describe('tituloLamina', () => {
  test('título SIN el prefijo "Lámina" → se antepone "Lámina NN · "', () => {
    assert.equal(tituloLamina('El territorio', 1), 'Lámina 01 · El territorio');
  });

  test('el dueño YA escribió "Lámina 01 · " — no se duplica (el defecto medido)', () => {
    assert.equal(tituloLamina('Lámina 01 · El territorio', 1), 'Lámina 01 · El territorio');
  });

  test('el prefijo se detecta sin importar mayúsculas ni el separador', () => {
    assert.equal(tituloLamina('LAMINA 02: La cosecha', 2), 'LAMINA 02: La cosecha');
    assert.equal(tituloLamina('lámina 3 - Las manos', 3), 'lámina 3 - Las manos');
    assert.equal(tituloLamina('Lámina 4 Secado', 4), 'Lámina 4 Secado');
  });

  test('título vacío → sólo el número, sin separador colgando', () => {
    assert.equal(tituloLamina('', 5), 'Lámina 05');
    assert.equal(tituloLamina('   ', 5), 'Lámina 05');
  });

  test('espacios sobrantes se recortan', () => {
    assert.equal(tituloLamina('  El territorio  ', 1), 'Lámina 01 · El territorio');
  });
});
