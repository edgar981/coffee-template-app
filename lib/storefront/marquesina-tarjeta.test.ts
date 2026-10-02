import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  modoTarjetaMarquesina,
  ASPECTO_TARJETA_MARQUESINA,
  TOLERANCIA_ASPECTO_TARJETA_MARQUESINA,
  SIZES_TARJETA_MARQUESINA,
} from './marquesina-tarjeta';

// Capa 1 de la regla "borde a borde si coincide, el tile si no" (§ MARQUESINA-TARJETA-PRODUCTO-1).

test('ASPECTO_TARJETA_MARQUESINA coincide con el aspect-[3/4] del tile de HeroMediaMarquesina.tsx', () => {
  assert.equal(ASPECTO_TARJETA_MARQUESINA, 3 / 4);
});

test('modoTarjetaMarquesina: foto EXACTA 3:4 → completa (borde a borde, sin padding, sin recorte posible)', () => {
  assert.equal(modoTarjetaMarquesina(1500, 2000), 'completa');
  assert.equal(modoTarjetaMarquesina(1800, 2400), 'completa');
  assert.equal(modoTarjetaMarquesina(3000, 4000), 'completa');
});

test('modoTarjetaMarquesina: foto 3:4 con redondeo de un par de píxeles (dentro de la tolerancia) → completa', () => {
  assert.equal(modoTarjetaMarquesina(1500, 1999), 'completa');
  assert.equal(modoTarjetaMarquesina(1500, 2001), 'completa');
});

test('modoTarjetaMarquesina: foto CUADRADA (1:1, ~33% de distancia) → tile, el prototipo con padding — object-contain no recorta', () => {
  assert.equal(modoTarjetaMarquesina(1000, 1000), 'tile');
});

test('modoTarjetaMarquesina: foto APAISADA (4:3, la forma opuesta) → tile', () => {
  assert.equal(modoTarjetaMarquesina(2000, 1500), 'tile');
});

test('modoTarjetaMarquesina: sin medir todavía (ancho/alto ausentes, cero o negativos) → tile, el modo que NUNCA recorta', () => {
  assert.equal(modoTarjetaMarquesina(undefined, undefined), 'tile');
  assert.equal(modoTarjetaMarquesina(undefined, 2000), 'tile');
  assert.equal(modoTarjetaMarquesina(1500, undefined), 'tile');
  assert.equal(modoTarjetaMarquesina(0, 0), 'tile');
  assert.equal(modoTarjetaMarquesina(1500, 0), 'tile');
  assert.equal(modoTarjetaMarquesina(-100, 200), 'tile');
});

test('TOLERANCIA_ASPECTO_TARJETA_MARQUESINA: justo en el borde de la tolerancia sigue siendo completa; un paso más allá cae a tile', () => {
  const alturaBorde = 2000 * (1 + TOLERANCIA_ASPECTO_TARJETA_MARQUESINA * 0.99);
  assert.equal(modoTarjetaMarquesina(1500, alturaBorde), 'completa');
  const alturaFuera = 2000 * (1 + TOLERANCIA_ASPECTO_TARJETA_MARQUESINA * 1.5);
  assert.equal(modoTarjetaMarquesina(1500, alturaFuera), 'tile');
});

test('SIZES_TARJETA_MARQUESINA: el breakpoint declarado es el viewport donde 62vw alcanza 340px (340/0.62)', () => {
  const breakpointReal = 340 / 0.62;
  const matched = SIZES_TARJETA_MARQUESINA.match(/min-width:\s*(\d+)px/);
  assert.ok(matched, 'debe declarar un min-width en px');
  const declarado = Number(matched![1]);
  assert.ok(
    Math.abs(declarado - breakpointReal) < 1,
    `el breakpoint declarado (${declarado}px) debe estar a menos de 1px del real (${breakpointReal.toFixed(2)}px)`,
  );
  assert.match(SIZES_TARJETA_MARQUESINA, /340px/);
  assert.match(SIZES_TARJETA_MARQUESINA, /62vw/);
});
