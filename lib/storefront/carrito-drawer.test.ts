import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composicionCarrito } from './carrito-drawer';

test('anclado -- byte a byte lo de HOY, sin importar si hay página de carrito', () => {
  assert.deepEqual(composicionCarrito('anclado', false), {
    ctaLabel: 'Ir al Checkout',
    mostrarBotonSecundario: false,
    claseIconoVacio: 'text-[var(--sf-tostado)]',
    claseTituloVacio: 'font-medium',
    claseCajaCantidad: 'bg-[var(--sf-superficie)]',
  });
  assert.equal(
    composicionCarrito('anclado', true).mostrarBotonSecundario,
    false,
    'anclado nunca muestra el secundario, ni con página real de carrito',
  );
});

test('flotante sin página de carrito -- "Pagar", sin secundario (no inventar una ruta que no existe)', () => {
  const c = composicionCarrito('flotante', false);
  assert.equal(c.ctaLabel, 'Pagar');
  assert.equal(c.mostrarBotonSecundario, false);
});

test('flotante con página de carrito -- el secundario SÍ se habilita', () => {
  assert.equal(composicionCarrito('flotante', true).mostrarBotonSecundario, true);
});

test('flotante -- el ícono del vacío deja el tono cálido/crema, usa el MISMO rol que la bolsa de la cabecera', () => {
  assert.equal(composicionCarrito('flotante', false).claseIconoVacio, 'text-[var(--sf-acento-texto)]');
  assert.notEqual(
    composicionCarrito('flotante', false).claseIconoVacio,
    composicionCarrito('anclado', false).claseIconoVacio,
  );
});

test('flotante -- el título del vacío usa la fuente de título, no la de cuerpo', () => {
  assert.match(composicionCarrito('flotante', false).claseTituloVacio, /font-playfair/);
  assert.doesNotMatch(composicionCarrito('anclado', false).claseTituloVacio, /font-playfair/);
});

test('flotante -- la caja de cantidad pierde el relleno y gana borde; anclado se queda con el relleno de HOY', () => {
  const flotante = composicionCarrito('flotante', false).claseCajaCantidad;
  assert.match(flotante, /sf-borde/);
  assert.doesNotMatch(flotante, /bg-\[var\(--sf-superficie\)\]/);

  const anclado = composicionCarrito('anclado', false).claseCajaCantidad;
  assert.match(anclado, /bg-\[var\(--sf-superficie\)\]/);
  assert.doesNotMatch(anclado, /sf-borde/);
});

test('una variante desconocida (basura defensiva) cae en el comportamiento de HOY, nunca en flotante', () => {
  // @ts-expect-error -- prueba deliberada de un valor fuera del dominio cerrado
  assert.equal(composicionCarrito('lo-que-sea', false).ctaLabel, 'Ir al Checkout');
});
