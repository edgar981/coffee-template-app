import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAICES_DEFECTO, contraste } from '@/lib/config/palette-derive';
import { paletaLaminas, sugerenciasLaminas, colorDeLamina, lavadoLamina, HEX6 } from './laminas';

// ─── EL COLOR: elegido vs. por orden ───────────────────────────────────────────────────────────────

test('colorDeLamina: un hex elegido en coloresPorProducto GANA, sin importar el índice', () => {
  const color = colorDeLamina('prod-1', 0, { 'prod-1': '#ff00aa' });
  assert.equal(color, '#ff00aa');
});

test('colorDeLamina: sin color elegido, asigna por ORDEN de la paleta derivada del tema', () => {
  const paleta = paletaLaminas();
  assert.equal(colorDeLamina('prod-a', 0, {}), paleta[0]);
  assert.equal(colorDeLamina('prod-b', 1, {}), paleta[1]);
  assert.equal(colorDeLamina('prod-c', 2, {}), paleta[2]);
});

test('colorDeLamina: un valor inválido en el mapa (no hex) se ignora, cae al orden', () => {
  const paleta = paletaLaminas();
  assert.equal(colorDeLamina('prod-1', 0, { 'prod-1': 'rojo' }), paleta[0]);
});

test('colorDeLamina: la asignación por orden es CÍCLICA — un catálogo más largo que la paleta reusa desde el principio', () => {
  const paleta = paletaLaminas();
  assert.equal(colorDeLamina('prod-x', paleta.length, {}), paleta[0]);
  assert.equal(colorDeLamina('prod-y', paleta.length + 1, {}), paleta[1]);
});

test('colorDeLamina: un producto BORRADO del catálogo simplemente deja de pedirse (no afecta a los demás)', () => {
  // El mapa puede tener una entrada "huérfana" (un id que ya no existe en el catálogo real); la
  // función no la lee salvo que alguien la pida por ESE id — no hay poda ni efecto sobre otros ids.
  const coloresPorProducto = { 'prod-borrado': '#123456', 'prod-vivo': '#abcdef' };
  assert.equal(colorDeLamina('prod-vivo', 0, coloresPorProducto), '#abcdef');
});

test('colorDeLamina: un producto NUEVO (sin entrada en el mapa) toma color por su posición', () => {
  const paleta = paletaLaminas();
  const coloresPorProducto = { 'prod-viejo': '#111111' };
  // El nuevo entra en el índice 1 del catálogo (después del viejo) y no tiene entrada propia.
  assert.equal(colorDeLamina('prod-nuevo', 1, coloresPorProducto), paleta[1]);
});

// ─── LA PALETA DE RESERVA es DERIVADA, no un hex fijo de ningún cliente ────────────────────────────

test('paletaLaminas: todos los hex son de 6 dígitos válidos', () => {
  for (const hex of paletaLaminas()) assert.match(hex, HEX6);
});

test('sugerenciasLaminas: una entrada por color de la paleta, con nombre llano por ORDEN', () => {
  const paleta = paletaLaminas();
  const sugerencias = sugerenciasLaminas();
  assert.equal(sugerencias.length, paleta.length);
  assert.equal(sugerencias[0].nombre, 'Color 1');
  assert.equal(sugerencias[0].hex, paleta[0]);
});

test('paletaLaminas: con otras raíces (un tema custom) la paleta CAMBIA — nunca un hex fijo', () => {
  const nayoli = paletaLaminas();
  const custom = paletaLaminas({ fondo: '#fdfbf7', tinta: '#102407', acento: '#a70004' });
  assert.notDeepEqual(nayoli, custom);
});

// ─── EL LAVADO: AA contra la tinta del tema, para los colores SUGERIDOS ────────────────────────────

test('lavadoLamina: el lavado de CADA color sugerido pasa AA (4.5:1) contra la tinta del tema (Nayoli)', () => {
  for (const { hex } of sugerenciasLaminas()) {
    const lavado = lavadoLamina(hex);
    const ratio = contraste(RAICES_DEFECTO.tinta, lavado);
    assert.ok(ratio >= 4.5, `lavado de ${hex} dio ${ratio.toFixed(2)}:1 contra la tinta`);
  }
});

test('lavadoLamina: el lavado de CADA color sugerido pasa AA contra la tinta de un tema CUSTOM también', () => {
  const raices = { fondo: '#fdfbf7', tinta: '#102407', acento: '#a70004' };
  for (const { hex } of sugerenciasLaminas(raices)) {
    const lavado = lavadoLamina(hex, raices);
    const ratio = contraste(raices.tinta, lavado);
    assert.ok(ratio >= 4.5, `lavado de ${hex} dio ${ratio.toFixed(2)}:1 contra la tinta custom`);
  }
});

test('lavadoLamina: un color que YA pasa AA sin mezclar se queda igual (peso 0)', () => {
  // La propia tinta del tema, usada como "color de café", ya tiene máximo contraste contra sí misma
  // en el sentido inverso — en cambio un color muy OSCURO (como la tinta) falla contra sí mismo
  // (1:1), así que se prueba con un color ya CLARO: el propio fondo, que debe pasar sin mezclar nada.
  const lavado = lavadoLamina(RAICES_DEFECTO.fondo);
  assert.equal(lavado, RAICES_DEFECTO.fondo);
});
