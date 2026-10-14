import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAICES_DEFECTO } from '@/lib/config/palette-derive';
import { paletaLaminas, colorDeLamina } from '@/lib/tienda/laminas';
import { stickersDeCatalogo } from './interludio-stickers';
import type { Product } from '@/types/product';

function producto(over: Partial<Product> & { id: string; slug: string; nombre: string }): Product {
  return {
    categoria: 'Café',
    precio: 42000,
    costo: 0,
    sku: null,
    stock: 10,
    activo: true,
    descripcion: '',
    ...over,
  };
}

// ─── EL COLOR: el MISMO mapa que «Láminas» de /tienda ───────────────────────────────────────────

test('stickersDeCatalogo: el color sale de colorDeLamina — mismo resultado que llamarlo directo con el mismo índice', () => {
  const catalogo = [
    producto({ id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado' }),
    producto({ id: 'p2', slug: 'pacamara', nombre: 'Pacamara' }),
  ];
  const coloresPorProducto = {};
  const out = stickersDeCatalogo(catalogo, coloresPorProducto);
  assert.equal(out[0].color, colorDeLamina('p1', 0, coloresPorProducto));
  assert.equal(out[1].color, colorDeLamina('p2', 1, coloresPorProducto));
});

test('stickersDeCatalogo: un color elegido en coloresPorProducto GANA, igual que en «Láminas»', () => {
  const catalogo = [producto({ id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado' })];
  const out = stickersDeCatalogo(catalogo, { p1: '#ff00aa' });
  assert.equal(out[0].color, '#ff00aa');
});

test('stickersDeCatalogo: sin color elegido, cae a la paleta de reserva derivada del tema — nunca falla', () => {
  const catalogo = [producto({ id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado' })];
  const paleta = paletaLaminas(RAICES_DEFECTO);
  const out = stickersDeCatalogo(catalogo, {}, RAICES_DEFECTO);
  assert.equal(out[0].color, paleta[0]);
});

// ─── LA FOTO: null = sin foto, nunca un placeholder inventado ───────────────────────────────────

test('stickersDeCatalogo: con imagen, la trae tal cual', () => {
  const catalogo = [producto({ id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado', imagen: '/images/bolsa.webp' })];
  const out = stickersDeCatalogo(catalogo, {});
  assert.equal(out[0].imagen, '/images/bolsa.webp');
});

test('stickersDeCatalogo: sin imagen (undefined), imagen es null — "la tarjeta de color sola"', () => {
  const catalogo = [producto({ id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado' })];
  const out = stickersDeCatalogo(catalogo, {});
  assert.equal(out[0].imagen, null);
});

test('stickersDeCatalogo: imagen vacía ("") también es null — no un <img src=""> roto', () => {
  const catalogo = [producto({ id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado', imagen: '' })];
  const out = stickersDeCatalogo(catalogo, {});
  assert.equal(out[0].imagen, null);
});

// ─── LAS NOTAS: joineadas con ' · ', null para omitir la línea ──────────────────────────────────

test('stickersDeCatalogo: las notas se joinean con " · " — el formato de tag corto de TiendaLaminas/TiendaEncabezado/TiendaTaquilla/SuscripcionCasillas, no la oración de fraseNotas', () => {
  const catalogo = [producto({ id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado', notas: ['Floral', 'Frutos rojos', 'Dulce'] })];
  const out = stickersDeCatalogo(catalogo, {});
  assert.equal(out[0].notas, 'Floral · Frutos rojos · Dulce');
});

test('stickersDeCatalogo: sin notas (undefined), notas es null — "sin notas, sin línea"', () => {
  const catalogo = [producto({ id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado' })];
  const out = stickersDeCatalogo(catalogo, {});
  assert.equal(out[0].notas, null);
});

test('stickersDeCatalogo: notas vacías ([]) también es null', () => {
  const catalogo = [producto({ id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado', notas: [] })];
  const out = stickersDeCatalogo(catalogo, {});
  assert.equal(out[0].notas, null);
});

// ─── EL RESTO del dato viaja tal cual, por orden de catálogo ────────────────────────────────────

test('stickersDeCatalogo: id/slug/nombre viajan tal cual, en el orden del catálogo', () => {
  const catalogo = [
    producto({ id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado' }),
    producto({ id: 'p2', slug: 'pacamara', nombre: 'Pacamara' }),
  ];
  const out = stickersDeCatalogo(catalogo, {});
  assert.deepEqual(
    out.map((s) => ({ id: s.id, slug: s.slug, nombre: s.nombre })),
    [
      { id: 'p1', slug: 'bourbon', nombre: 'Bourbon Rosado' },
      { id: 'p2', slug: 'pacamara', nombre: 'Pacamara' },
    ],
  );
});

test('stickersDeCatalogo: catálogo vacío → array vacío', () => {
  assert.deepEqual(stickersDeCatalogo([], {}), []);
});
